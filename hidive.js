// modules build-in
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// package json
const packageJson = require(path.join(__dirname,'package.json'));

// program name
console.log(`\n=== HIDIVE Downloader NX ${packageJson.version} ===\n`);
const modulesFolder = path.join(__dirname,'modules');

// api const
const API_DOMAIN = "https://api.hidive.com";
const API_KEY    = "6e6b1afcf0800e2ba312bce28d1dbccc87120904";

// app id
const devName = "Android";
const appId   = "24i-Android";

// api vars
let deviceId         = "";
let visitId          = "";
let profile = {
    userId: 0,
    profileId: 0
}

// builder vars
let ipAddress        = "";
let xNonce           = "";
let xSignature       = "";

// modules extra
const yaml = require('yaml');
const shlp = require('sei-helper');
const yargs = require('yargs');
const request = require('request');
const agent = require('socks5-https-client/lib/Agent');
const vtt = require(path.join(__dirname,'modules','module.vttconvert'));

// m3u8
const m3u8 = require('m3u8-parsed');
const streamdl = require('hls-download');

// config
const configFile = path.join(modulesFolder,'config.main.yml');
const sessionFile = path.join(modulesFolder,'config.session.yml');
const profileFile = path.join(modulesFolder,'config.profile.yml');

// params
let cfg = {};
let session = {};

if(!fs.existsSync(configFile)){
    console.log(`[ERROR] config file not found!`);
    process.exit();
}
else{
    cfg = yaml.parse(
        fs.readFileSync(configFile, 'utf8')
            .replace(/\${__dirname}/g,__dirname.replace(/\\/g,'/'))
    );
}

if(fs.existsSync(sessionFile)){
    session = yaml.parse(fs.readFileSync(sessionFile, 'utf8'));
}
if(fs.existsSync(profileFile)){
    profile = yaml.parse(fs.readFileSync(profileFile, 'utf8'));
}

// langs
const langCode = {
    'jpn': 'Japanese',
    'eng': 'English',
    'spa': 'Spanish',
    'spa-eu': 'Spanish',
    'spa-la': 'Spanish LatAm',
    'fre': 'French',
    'ger': 'German',
    'kor': 'Korean',
    'por': 'Portuguese',
    'tur': 'Turkish',
    'ita': 'Italian'
};

function getLangCode(lang){
    for (k in langCode) {
        let r = new RegExp(langCode[k], 'i');
        if (r.test(lang)) {
            return k.match(/-/) ? k.split('-')[0] : k;
        }
    }
    return 'unk';
}

/*
<option value="ja">Japanese</option>
<option value="sp">Latin American Spanish</option>
<option value="es">European Spanish</option>
<option value="pt">Portuguese</option>
<option value="de">German</option>
<option value="fr">French</option>
<option value="ko">Korean</option>
<option value="tr">Turkish</option>
<option value="it">Italian</option>
*/

// cli
let argv = yargs
    .wrap(Math.min(100))
    .usage('Usage: $0 [options]')
    .help(false).version(false)
    
    // login
    .describe('login','Enter login mode')
    
    // search
    .describe('search','Sets the show title for search')
    
    // params
    .describe('s','Sets the show id')
    .describe('e','Select episode ids (comma-separated)')
    
    .describe('q','Video quality')
    .choices('q', ['360p','480p','720p','1080p'])
    .default('q', cfg.cli.videoQuality)
    
    .describe('dub','Select dub language')
    .choices('dub', Object.keys(langCode))
    .default('dub', cfg.cli.dubLanguage)
    
    .describe('br','Forсe download broadcast version instead of home video version (if both versions presents)')
    .boolean('br')
    
    .describe('nosubs','Skip download subtitles for non-japanese dub (if available)')
    .boolean('nosubs')
    
    // proxy
    .describe('socks','Set ipv4 socks5 proxy')
    .describe('socks-login','Set socks5 username')
    .describe('socks-pass','Set socks5 password')
    .describe('proxy','Set ipv4 http(s) proxy')
    .describe('ssp','Don\'t use proxy for stream downloading')
    .boolean('ssp')
    
    .describe('mp4','Mux into mp4')
    .boolean('mp4')
    .default('mp4',cfg.cli.mp4mux)
    .describe('mks','Add subtitles to mkv (if available)')
    .boolean('mks')
    .default('mks',cfg.cli.muxSubs)
    
    .describe('a','Filenaming: Release group')
    .default('a',cfg.cli.releaseGroup)
    .describe('t','Filenaming: Series title override')
    .describe('ep','Filenaming: Episode number override (ignored in batch mode)')
    .describe('suffix','Filenaming: Filename suffix override (first "SIZEp" will be replaced with actual video size)')
    .default('suffix',cfg.cli.fileSuffix)
    
    // util
    .describe('stag','Subtitles file: Custom title tag')
    .default('stag',cfg.cli.assTitleTag)
    .describe('nocleanup','Move temporary files to trash folder instead of deleting')
    .boolean('nocleanup')
    .default('nocleanup',cfg.cli.noCleanUp)
    
    // help
    .describe('h','Show this help')
    .alias('h','help')
    .boolean('h')
    .version(false)
    
    .argv;

// fn variables
let fnTitle = '',
    fnEpNum = '',
    fnSuffix = '',
    fnOutput = '',
    tsDlPath = false,
    sxList   = [],
    fontSize = 34;

// go to work folder
try {
    fs.accessSync(cfg.dir.content, fs.R_OK | fs.W_OK)
} catch (e) {
    console.log(e);
    console.log(`[ERROR] %s`,e.messsage);
    process.exit();
}
process.chdir(cfg.dir.content);

// select mode
if(argv.login){
    doAuth();
}
else if(argv.search){
    doSearch();
}
else if(argv.s && !isNaN(parseInt(argv.s,10)) && parseInt(argv.s,10) > 0){
    getShow();
}
else{
    yargs.showHelp();
    process.exit();
}

// init
async function doInit(){
    const newIp = await getData('Ping', '');
    if(checkRes(newIp)){return false;}
    ipAddress = JSON.parse(newIp.res.body).IPAddress;
    const newDevice = await getData('InitDevice', JSON.stringify({"DeviceName":devName}));
    if(checkRes(newDevice)){return false;}
    deviceId = JSON.parse(newDevice.res.body).Data.DeviceId;
    visitId  = JSON.parse(newDevice.res.body).Data.VisitId;
    // const newVisitId = await getData('InitVisit', '');
    return true;
}

// Auth
async function doAuth(){
    const aInit = await doInit();
    if(!aInit){return;}
    const iLogin = await shlp.question(`LOGIN/EMAIL`);
    const iPsswd = await shlp.question(`PASSWORD   `);
    const auth = await getData('Authenticate', JSON.stringify({"Email":iLogin,"Password":iPsswd}));
    if(checkRes(auth)){return;}
    const authData = JSON.parse(auth.res.body).Data;
    profile.userId    = authData.User.Id;
    profile.profileId = authData.Profiles[0].Id;
    fs.writeFileSync(profileFile,yaml.stringify(profile));
    console.log(`[INFO] Auth complete!`);
    console.log(`[INFO] Service level for "${iLogin}" is ${JSON.parse(auth.res.body).Data.User.ServiceLevel}`);
}

// Search
async function doSearch(){
    const aInit = await doInit();
    if(!aInit){return;}
    const searchItems = await getData('Search', JSON.stringify({"Query":argv.search}));
    if(checkRes(searchItems)){return;}
    const sItems = JSON.parse(searchItems.res.body).Data.TitleResults;
    if(sItems.length>0){
        for(let i=0;i<sItems.length;i++){
            console.log(`[#${sItems[i].Id}] ${sItems[i].Name} [${sItems[i].ShowInfoTitle}]`);
        }
    }
    else{
        console.log(`[ERROR] Nothing found!`)
    }
}

// get season
async function getShow(){
    const aInit = await doInit();
    if(!aInit){return;}
    const getShowData = await getData('GetTitle', JSON.stringify({"Id":argv.s}));
    if(checkRes(getShowData)){return;}
    const showData = JSON.parse(getShowData.res.body).Data.Title;
    console.log(`[#${showData.Id}] ${showData.Name} [${showData.ShowInfoTitle}]`);
    let selEpsInp = argv.e ? argv.e.toString().split(',') : [];
    let selEpsArr = [];
    for(let i=0;i<showData.Episodes.length;i++){
        let epKey = showData.Episodes[i].VideoKey;
        let selMark = false;
        if(selEpsInp.includes(epKey)){
            selEpsArr.push(epKey);
            selMark = true;
        }
        console.log(`[${epKey}] ${showData.Episodes[i].Name}`+(selMark?' (selected)':''));
    }
    console.log();
    if(selEpsArr.length>0){
        for(let s=0;s<selEpsArr.length;s++){
            let getVideoData = await getData('GetVideos', JSON.stringify({"VideoKey":selEpsArr[s],"TitleId":argv.s}));
            if(!checkRes(getVideoData)){
                let videoData = JSON.parse(getVideoData.res.body);
                let ssNum = selEpsArr[s].match(/^s(\d+)/) ? parseInt(selEpsArr[s].match(/^s(\d+)/)[1]) : 1;
                let showTitle = ssNum > 1 ? `${showData.Name} S${ssNum}` : showData.Name;
                let epNum = selEpsArr[s].match(/e(\d+)$/) ? ('0'+selEpsArr[s].match(/e(\d+)$/)[1]).slice(-2) : selEpsArr[s];
                console.log(`[INFO] ${showTitle} - ${epNum}`);
                console.log(`[INFO] Selected dub: ${langCode[argv.dub]}`);
                // set customs
                fnTitle = argv.title ? argv.title : showTitle;
                fnEpNum = selEpsArr.length < 2 && argv.ep ? argv.ep : epNum;
                // --
                let videoList = videoData.Data.VideoLanguages;
                let subsList  = videoData.Data.CaptionLanguages;
                console.log(`Videos: `+videoList.join('\n\t'));
                console.log(`Subs  : `+subsList.join('\n\t'));
                // console.log(videoData);
                let videoUrls = videoData.Data.VideoUrls, videoUrl  = ``;
                let subsUrls  = videoData.Data.CaptionVttUrls;
                fontSize = videoData.Data.FontSize ? videoData.Data.FontSize : fontSize;
                let videoSel  = videoList.filter( v => v.match(langCode[argv.dub]) );
                if(videoSel.length===0){
                    console.log(`[ERROR] Selected dub not found!\n`);
                }
                else if(videoSel.length===1){
                    videoUrl = videoUrls[videoSel[0]].hls[0];
                    console.log(`[INFO] Downloading "${videoSel[0].split(',')[1].trim()}"`);
                    await downloadMedia(videoUrl,subsUrls,videoData.Data.FontSize);
                }
                else if(videoSel.length===2){
                    if(argv.br){
                        videoUrl = videoUrls[videoSel.filter(v=>v.match(/Broadcast/))[0]].hls[0];
                        console.log(`[INFO] Downloading "Broadcast"`);
                        await downloadMedia(videoUrl,subsUrls,videoData.Data.FontSize);
                    }
                    else{
                        videoUrl = videoUrls[videoSel.filter(v=>v.match(/Home Video/))[0]].hls[0];
                        console.log(`[INFO] Downloading "Home Video"`);
                        await downloadMedia(videoUrl,subsUrls,videoData.Data.FontSize);
                    }
                }
            }
        }
    }
    else{
        console.log(`[INFO] Episodes not selected!`);
    }
}

async function downloadMedia(videoUrl,subsUrls,fontSize){
    // console.log(videoUrl,subsUrls,fontSize);
    let getVideoQualities = await getData('!g!'+videoUrl, '');
    if(checkRes(getVideoQualities)){}
    let s = m3u8(getVideoQualities.res.body).playlists;
    let pls = {};
    for(let i=0;i<s.length;i++){
        let qs = s[i].attributes.RESOLUTION.height+'p';
        let qb = Math.round(s[i].attributes.BANDWIDTH/1024);
        console.log(`[quality] ${qs} @ ${qb}kbps`+(qs==argv.q?` (selected)`:``));
        if(qs==argv.q){
            tsDlPath = s[i].uri;
        }
    }
    if(!tsDlPath){
        console.log(`[ERROR] Selected video quality not found!\n`)
    }
    else{
        // video download
        let reqVid = await getData('!g!'+tsDlPath,'');
        if(checkRes(reqVid)){return;}
        
        let chunkList = m3u8(reqVid.res.body);
        chunkList.baseUrl = tsDlPath.split('/').slice(0, -1).join('/')+'/';
        fnSuffix = argv.suffix.replace('SIZEp',argv.q);
        fnOutput = shlp.cleanupFilename(`[${argv.a}] ${fnTitle} - ${fnEpNum} [${fnSuffix}]`);
        
        let subsMargin = 0;
        if(chunkList.segments[0].uri.match(/\/bumpers\//)){
            subsMargin = chunkList.segments[0].duration;
            chunkList.segments.splice(0, 1);
        }
        
        let proxy;
        if(argv.socks && !argv.ssp){
            proxy = { "host": argv.socks, "type": "socks" };
            if(argv['socks-login'] && argv['socks-pass']){
                proxy['socks-login'] = argv['socks-login'];
                proxy['socks-pass'] = argv['socks-pass'];
            }
        }
        else if(argv.proxy && !argv.ssp){
            proxy = { "host": argv.proxy, "type": "http" };
        }
        let dldata = await streamdl({
            fn: fnOutput,
            m3u8json: chunkList,
            baseurl: chunkList.baseUrl,
            proxy: (proxy?proxy:false)
        });
        if(!dldata.ok){
            console.log(`[ERROR] ${dldata.err}\n`);
            return;
        }
        console.log(`[INFO] Video downloaded!\n`);
        // subs download
        argv.stag = argv.stag ? argv.stag : argv.a
        argv.stag = shlp.cleanupFilename(argv.stag);
        let subsLangArr = Object.keys(subsUrls);
        sxList = [];
        argv.nosubs = argv.dub == 'jpn' ? false : argv.nosubs;
        if(!argv.nosubs && subsLangArr.length > 0){
            for(let z=0; z<subsLangArr.length; z++){
                let vttStr = '', cssStr = '', assStr = '', assExt = 'ass';
                let subs4XUrl = subsUrls[subsLangArr[z]].split('/');
                subsXUrl = getSubsUrl(subs4XUrl[subs4XUrl.length-1].replace(/.vtt$/,''));
                let getCssContent = await getData('!g!'+subsXUrl.css, '');
                let getVttContent = await getData('!g!'+subsXUrl.vtt, '');
                if(!checkRes(getCssContent) && !checkRes(getVttContent)){
                    let subFn = `${fnOutput}.${subsLangArr[z]}`;
                    cssStr = getCssContent.res.body;
                    vttStr = getVttContent.res.body;
                    assStr = vtt(argv.stag,fontSize,vttStr,cssStr,subsMargin);
                    fs.writeFileSync(`${subFn}.${assExt}`, assStr,'utf8');
                    sxList.push({
                        file: `${subFn}.${assExt}`,
                        language: subsLangArr[z],
                        langCode: getLangCode(subsLangArr[z])
                    });
                    console.log(`[INFO] Subtitle downloaded and converted: ${subFn}.${assExt}`);
                }
            }
        }
        // go to muxing
        await muxStreams();
    }
}

function getSubsUrl(file){
    const prefix = 'https://api.hidive.com/caption';
    return {
        vtt: `${prefix}/vtt/${file}.vtt`,
        css: `${prefix}/css/?id=${file}.css`
    };
}

async function muxStreams(){
    // fix variables
    argv.dub = argv.dub.match('-') ? argv.dub.split('-')[0] : argv.dub;
    let addSubs = argv.mks && sxList.length > 0 && !argv.mp4 ? true : false;
    // check exec
    if( !argv.mp4 && !isFile(cfg.bin.mkvmerge) && !isFile(cfg.bin.mkvmerge+`.exe`) ){
        console.log(`[WARN] MKVMerge not found, skip using this...`);
        cfg.bin.mkvmerge = false;
    }
    if( !isFile(cfg.bin.ffmpeg) && !isFile(cfg.bin.ffmpeg+`.exe`) ){
        console.log((cfg.bin.mkvmerge?`\n`:``)+`[WARN] FFmpeg not found, skip using this...`);
        cfg.bin.ffmpeg = false;
    }
    // mux to mkv
    if(!argv.mp4 && cfg.bin.mkvmerge){
        let mkvmux  = `-o "${fnOutput}.mkv" --disable-track-statistics-tags --engage no_variable_data `;
            mkvmux += `--track-name "1:[${argv.a}]" --language "0:${argv.dub}" --video-tracks 1 --audio-tracks 0 --no-subtitles --no-attachments `;
            mkvmux += `"${fnOutput}.ts" `;
            if(addSubs){
                for(let t in sxList){
                    mkvmux += `--track-name "0:${sxList[t].language}" --language "0:${sxList[t].langCode}" --default-track "0:no" "${sxList[t].file}" `;
                }
            }
        shlp.exec(`mkvmerge`,`"${cfg.bin.mkvmerge}"`,mkvmux);
    }
    else if(cfg.bin.ffmpeg){
        let ffsubs = {fsubs:'',meta1:'',meta2:''};
        if(addSubs){
            for(let t in sxList){
                ffsubs.fsubs += `-i "${sxList[t].file}" `
                ffsubs.meta1 += `-map ${(parseInt(t)+1)} -c:s copy `;
                ffsubs.meta2 += `-metadata:s:s:${(t)} title="${sxList[t].language}" -metadata:s:s:${(t)} language=${sxList[t].langCode} `;
            }
        }
        let ffext = !argv.mp4 ? `mkv` : `mp4`;
        let ffmux = `-i "${fnOutput}.ts" `;
            ffmux += ffsubs.fsubs;
            ffmux += `-map 0 -c:v copy -c:a copy `;
            ffmux += ffsubs.meta1;
            ffmux += `-metadata encoding_tool="no_variable_data" `;
            ffmux += `-metadata:s:v:0 title="[${argv.a}]" -metadata:s:a:0 language=${argv.dub} `;
            ffmux += ffsubs.meta2;
            ffmux += `"${fnOutput}.${ffext}"`;
        // mux to mkv
        try{ shlp.exec(`ffmpeg`,`"${cfg.bin.ffmpeg}"`,ffmux); }catch(e){}
    }
    else{
        console.log(`\n[INFO] Done!\n`);
        return;
    }
    if(argv.nocleanup){
        fs.renameSync(fnOutput+`.ts`, path.join(cfg.dir.trash,`/${fnOutput}.ts`));
        if(addSubs){
            for(let t in sxList){
                fs.renameSync(sxList[t].file, path.join(cfg.dir.trash,`/${sxList[t].file}`));
            }
        }
    }
    else{
        fs.unlinkSync(fnOutput+`.ts`);
        if(addSubs){
            for(let t in sxList){
                fs.unlinkSync(sxList[t].file);
            }
        }
    }
    console.log(`\n[INFO] Done!\n`);
}

function isFile(file){
    try{
        const isFile = fs.statSync(file).isFile();
        return isFile;
    }
    catch(e){
        return false;
    }
}

// check resp
function checkRes(r){
    if(r.err || r.status != 200){
        console.log(`[ERROR] ${r.status}`);
        if(r.status == 404 && r.res && r.res.body){
            delete r.res.body;
        }
        console.log(JSON.stringify(r.res,null,'\t'));
        return true;
    }
    else{
        if(r.res.body.match(/^{/)){
            const resJ = JSON.parse(r.res.body);
            if(resJ.Code > 0){
                console.log(`[ERROR] ${resJ.Code}: ${resJ.Message}\n`);
                return true;
            }
            else{
                return false;
            }
        }
        else{
            return false;
        }
    }
}

// Generate Nonce
function generateNonce(){
    const initDate      = new Date();
    const nonceDate     = [
        initDate.getUTCFullYear().toString().slice(-2),
        ('0'+(initDate.getUTCMonth()+1)).slice(-2),
        ('0'+initDate.getUTCDate()).slice(-2),
        ('0'+initDate.getUTCHours()).slice(-2),
        ('0'+initDate.getUTCMinutes()).slice(-2)
    ].join(''); // => "UTC:yymmddHHMM"
    const nonceCleanStr = nonceDate + API_KEY;
    const nonceHash     = crypto.createHash('sha256').update(nonceCleanStr).digest('hex');
    return nonceHash;
}
// Generate Signature
function generateSignature(body){
    const sigCleanStr = ipAddress + appId + deviceId + visitId + profile.userId + profile.profileId + body + xNonce + API_KEY;
    return crypto.createHash('sha256').update(sigCleanStr).digest('hex');
}
// get data from url
function getData(method, body){
    // gen nonce and sig
    xNonce     = generateNonce();
    xSignature = generateSignature(body);
    // make
    let options = {};
    options.method = method.match(/^!g!/) ? 'GET' : 'POST';
    options.url = ( !method.match(/^!g!/) ? API_DOMAIN + '/api/v1/' : '') + method.replace(/^!g!/,'');
    options.body = body;
    options.headers = {
        'User-Agent':      (method.match(/^!g!/) ? 'smartexoplayer/1.6.0.R (Linux;Android 6.0) ExoPlayerLib/2.6.0' : 'okhttp/3.4.1'),
        'Content-Type':    'application/x-www-form-urlencoded; charset=UTF-8',
    };
    if(options.url.match(new RegExp(API_DOMAIN))){
        options.headers = Object.assign({
            'X-ApplicationId': appId,
            'X-DeviceId':      deviceId,
            'X-VisitId':       visitId,
            'X-UserId':        profile.userId,
            'X-ProfileId':     profile.profileId,
            'X-Nonce':         xNonce,
            'X-Signature':     xSignature
        }, options.headers);
        // cookies
        let cookiesList = Object.keys(session);
        if(cookiesList.length>0){
            options.headers.Cookie = shlp.cookie.make(session,cookiesList);
        }
    }
    // proxy
    if(argv.socks){
        options.agentClass = agent;
        let agentOptions = {
            socksHost: argv.socks.split(':')[0],
            socksPort: argv.socks.split(':')[1]
        };
        if(argv['socks-login'] && argv['socks-pass']){
            agentOptions.socksUsername = argv['socks-login'];
            agentOptions.socksPassword = argv['socks-pass'];
        }
        options.agentOptions = agentOptions;
        options.timeout = 10000;
    }
    else if(argv.proxy){
        options.proxy = 'http://'+argv.proxy;
        options.timeout = 10000;
    }
    // options test
    // console.log(options);
    // do request
    return new Promise((resolve) => {
        request(options, (err, res) => {
            if (err){
                res = err;
                resolve({ "err": true, "status": 0, res });
            }
            if (res.statusCode != 200) {
                resolve({ "err": true, "status": res.statusCode, res });
            }
            // console.log(JSON.stringify(res,null,'\t'));
            if(!method.match(/^!g!/) && res.headers && res.headers['set-cookie']){
                const newReqCookies = shlp.cookie.parse(res.headers['set-cookie']);
                delete newReqCookies.AWSALB;
                delete newReqCookies['.AspNet.ExternalCookie'];
                delete newReqCookies.Campaign;
                session = Object.assign(newReqCookies, session);
                if(session.Visitor || session.VisitId || session['.AspNet.ApplicationCookie']){
                    // console.log(session);
                    fs.writeFileSync(sessionFile,yaml.stringify(session));
                }
            }
            resolve({ "err": false, "status": res.statusCode, res});
        });
    });
}
