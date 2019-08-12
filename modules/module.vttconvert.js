// modules
const fs = require('fs');
const path = require('path');

// const
const cssPrefixRx = /\.rmp-container>\.rmp-content>\.rmp-cc-area>\.rmp-cc-container>\.rmp-cc-display>\.rmp-cc-cue /g;

// colors
const colors = require('./module.colors');
const defaultStyleName = 'Default';
const defaultStyleFont = 'Arial';

// predefined
let relGroup = '';
let fontSize = 0;
let tmMrg    = 0;
let rFont    = '';

function loadCSS(cssStr) {
    let css = cssStr;
    css = css.replace(cssPrefixRx, '').replace(/[\r\n]+/g, '\n').split('\n');
    let defaultSFont = rFont == '' ? defaultStyleFont : rFont;
    let defaultStyle = `${defaultSFont},${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,20,20,20,1`
    let styles = { [defaultStyleName]: { params: defaultStyle, list: [] } };
    let classList = { [defaultStyleName]: 1 };
    for (let i in css) {
        let clx, clz, clzx, rgx;
        let l = css[i];
        if (l === '') continue;
        let m = l.match(/^(.*)\{(.*)\}$/);
        if (!m) console.error(`[WARN] VTT2ASS: Invalid css in line ${i}: ${l}`);
        let style = parseStyle(m[2], defaultStyle);
        if (m[1] === '') {
            styles[defaultStyleName].params = style;
            defaultStyle = style;
        }
        else {
            clx = m[1].replace(/\./g, '').split(',');
            clz = clx[0].replace(/-C(\d+)_(\d+)$/i,'').replace(/-(\d+)$/i,'');
            classList[clz] = (classList[clz] || 0) + 1;
            rgx = classList[clz];
            classSubNum = rgx > 1 ? `-${rgx}` : '';
            clzx = clz + classSubNum;
            styles[clzx] = { params: style, list: clx };
        }
    }
    return styles;
}

function parseStyle(line, style) {
    // Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour,
    // BackColour, Bold, Italic, Underline, StrikeOut,
    // ScaleX, ScaleY, Spacing, Angle, BorderStyle,
    // Outline, Shadow, Alignment, MarginL, MarginR,
    // MarginV, Encoding
    style = style.split(',');
    for (let s of line.split(';')) {
        if (s == '') continue;
        let st = s.trim().split(':');
        let cl;
        switch (st[0]) {
            case 'font-family':
                style[0] = rFont == '' ? st[1].match(/[\s"]*([^",]*)/)[1] : rFont;
                break;
            case 'font-size':
                style[1] = getPxSize(st[1]);
                break;
            case 'color':
                cl = getColor(st[1]);
                if (cl !== null) {
                    if (cl == '&H0000FFFF'){
                        style[2] = style[3] = '&H00FFFFFF';
                    }
                    else{
                        style[2] = style[3] = cl;
                    }
                }
                break;
            case 'font-weight':
                if (st[1] === 'bold') {
                    style[6] = -1;
                    break;
                }
                if (st[1] === 'normal') {
                    break;
                }
            case 'font-style':
                if (st[1] === 'italic') {
                    style[7] = -1;
                    break;
                }
            case 'background':
                if(st[1] === 'none'){
                    break;
                }
            case 'text-shadow':
                st[1] = st[1].split(',').map(r => r.trim());
                st[1] = st[1].map(r => { return ( r.split(' ').length > 3 ? r.replace(/(\d+)px black$/,'') : r.replace(/black$/,'') ).trim() });
                st[1] = st[1].map(r => r.replace(/-/g,'').replace(/px/g,'').replace(/(^| )0( |$)/g,' ').trim()).join(' ');
                st[1] = st[1].split(' ');
                if(st[1].length != 10){
                    console.log(`[WARN] VTT2ASS: Can't properly parse text-shadow: ${s.trim()}`);
                    break;
                }
                st[1] = [...new Set(st[1])];
                if(st[1].length > 1){
                    console.log(`[WARN] VTT2ASS: Can't properly parse text-shadow: ${s.trim()}`);
                    break;
                }
                style[16] = st[1][0];
                break;
            default:
                console.error(`[WARN] VTT2ASS: Unknown style: ${s.trim()}`);
        }
    }
    return style.join(',');
}

function getPxSize(size) {
    let m = size.trim().match(/([\d.]+)(.*)/);
    if (!m) console.error(`[WARN] VTT2ASS: Unknown size: ${size}`);
    if (m[2] === 'em') m[1] *= fontSize;
    return Math.round(m[1]);
}

function getColor(c) {
    if (c[0] !== '#') {
        c = colors[c];
    }
    else if (c.length < 7) {
        c = `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
    }
    let m = c.match(/#(..)(..)(..)/);
    if (!m) return null;
    return `&H00${m[3]}${m[2]}${m[1]}`.toUpperCase();
}

function loadVTT(vttStr) {
    const rx = /^([\d:.]*) --> ([\d:.]*)\s?(.*?)\s*$/;
    let lines = vttStr.replace(/\r?\n/g, '\n').split('\n');
    let data = [];
    let record = null;
    let lineBuf = [];
    for (let l of lines) {
        let m = l.match(rx);
        if (m) {
            let caption = '';
            if (lineBuf.length > 0) {
                caption = lineBuf.pop();
            }
            if (caption !== '' && lineBuf.length > 0) {
                lineBuf.pop();
            }
            if (record !== null) {
                record.text = lineBuf.join('\n');
                data.push(record);
            }
            record = {
                caption,
                time: {
                    start: m[1],
                    end: m[2],
                    ext: m[3].split(' ').map(x => x.split(':')).reduce((p, c) => (p[c[0]] = c[1]) && p, {}),
                }
            };
            lineBuf = [];
            continue;
        }
        lineBuf.push(l);
    }
    if (record !== null) {
        if (lineBuf[lineBuf.length - 1] === '') {
            lineBuf.pop();
        }
        record.text = lineBuf.join('\n');
        data.push(record);
    }
    return data;
}

function convert(css, vtt) {
    let stylesMap = {};
    let ass = [
        '\ufeff[Script Info]',
        'Title: '+relGroup,
        'ScriptType: v4.00+',
        'WrapStyle: 0',
        'PlayResX: 1280',
        'PlayResY: 720',
        'ScaledBorderAndShadow: yes',
        '',
        '[V4+ Styles]',
        'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    ];
    for (let s in css) {
        ass.push(`Style: ${s},${css[s].params}`);
        css[s].list.forEach(x => stylesMap[x] = s);
    }
    ass = ass.concat([
        '',
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
    ]);
    let events = {
        subtitle: [],
        caption: [],
        capt_pos: [],
        song_cap: [],
    };
    let linesMap = {};
    for (let l in vtt) {
        let x = convertLine(stylesMap, vtt[l]);
        if (x.ind !== '' && linesMap[x.ind] !== undefined){
            if(x.subInd > 1){
                let fx = convertLine(stylesMap, vtt[l-x.subInd+1]);
                if(x.style != fx.style){
                    x.text = `{\\r${x.style}}${x.text}{\\r}`;
                }
            }
            events[x.type][linesMap[x.ind]] += '\\N' + x.text;
        }
        else {
            events[x.type].push(x.res);
            if (x.ind !== '') {
                linesMap[x.ind] = events[x.type].length - 1;
            }
        }

    }
    if(events.subtitle.length>0){
        ass = ass.concat(
            `Comment: 0,0:00:00.00,0:00:00.00,${defaultStyleName},,0,0,0,,** Subtitles **`,
            events.subtitle
        );
    }
    if(events.caption.length>0){
        ass = ass.concat(
            `Comment: 0,0:00:00.00,0:00:00.00,${defaultStyleName},,0,0,0,,** Captions **`,
            events.caption
        );
    }
    if(events.capt_pos.length>0){
        ass = ass.concat(
            `Comment: 0,0:00:00.00,0:00:00.00,${defaultStyleName},,0,0,0,,** Captions with position **`,
            events.capt_pos
        );
    }
    if(events.song_cap.length>0){
        ass = ass.concat(
            `Comment: 0,0:00:00.00,0:00:00.00,${defaultStyleName},,0,0,0,,** Song captions **`,
            events.song_cap
        );
    }
    return ass.join('\r\n') + '\r\n';
}

function convertLine(css, l) {
    let start = convertTime(l.time.start);
    let end = convertTime(l.time.end);
    let txt = convertText(l.text);
    let type = txt.style.match(/Caption/i) ? 'caption' : (txt.style.match(/SongCap/i) ? 'song_cap' : 'subtitle');
    type = type == 'caption' && l.time.ext.position !== undefined ? 'capt_pos' : type;
    if (l.time.ext.align === 'left') {
        txt.text = `{\\an7}${txt.text}`;
    }
    let ind = '', subInd = 1;
    let sMinus = 0; // (19.2 * 2);
    if (l.time.ext.position !== undefined) {
        let pos = parseInt(l.time.ext.position);
        let PosX = pos < 0 ? (1280 / 100 * (100 - pos)) : ((1280 - sMinus) / 100 * pos);
        let line = parseInt(l.time.ext.line) || 0;
        let PosY = line < 0 ? (720 / 100 * (100 - line)) : ((720 - sMinus) / 100 * line);
        txt.text = `{\\pos(${parseFloat(PosX.toFixed(3))},${parseFloat(PosY.toFixed(3))})}${txt.text}`;
    }
    else if(l.time.ext.line !== undefined && type == 'caption'){
        let line = parseInt(l.time.ext.line);
        let PosY = line < 0 ? (720 / 100 * (100 - line)) : ((720 - sMinus) / 100 * line);
        txt.text = `{\\pos(640,${parseFloat(PosY.toFixed(3))})}${txt.text}`;
    }
    else {
        indregx = txt.style.match(/(.*)_(\d+)$/);
        if(indregx !== null){
            ind    = indregx[1];
            subInd = parseInt(indregx[2]);
        }
    }
    let style = css[txt.style] || defaultStyleName;
    let res = `Dialogue: 0,${start},${end},${style},,0,0,0,,${txt.text}`;
    return { type, ind, subInd, start, end, style, text: txt.text, res };
}

function convertText(text) {
    let m = text.match(/<c\.([^>]*)>([\S\s]*)<\/c>/);
    let style = '';
    if (m) {
        style = m[1];
        text = m[2];
    }
    xtext = text
        .replace(/\n/g, '\\N')
        .replace(/ \\N$/g, '\\N')
        .replace(/<b[^>]*>([^<]*)<\/b>/g, '{\\b1}$1{\\b0}')
        .replace(/<i[^>]*>([^<]*)<\/i>/g, '{\\i1}$1{\\i0}')
        .replace(/<u[^>]*>([^<]*)<\/u>/g, '{\\u1}$1{\\u0}')
        // .replace(/<c[^>]*>[^<]*<\/c>/g, '')
        // .replace(/<ruby[^>]*>[^<]*<\/ruby>/g, '')
        .replace(/<[^>]>/g, '')
        .replace(/\\N$/, '');
    text = xtext;
    return { style, text };
}

function convertTime(tm) {
    let m = tm.match(/([\d:]*)\.?(\d*)/);
    if (!m) return '0:00:00.00';
    return toSubTime(m[0]);
}

function toSubTime(str) {
    let n = [], x, sx, s;
    x = str.split(/[:.]/).map(x => Number(x));
    x[3] = '0.'+('00'+x[3]).slice(-3);
    sx = (x[0]*60*60 + x[1]*60 + x[2] + Number(x[3]) - tmMrg).toFixed(2);
    sx = sx.toString().split('.');
    n.unshift(sx[1]);
    sx = Number(sx[0]);
    n.unshift(('0'+((sx%60).toString())).slice(-2));
    n.unshift(('0'+((Math.floor(sx/60)%60).toString())).slice(-2));
    n.unshift((Math.floor(sx/3600)%60).toString());
    return n.slice(0, 3).join(':') + '.' + n[3];
}

module.exports = (group, xFontSize, vttStr, cssStr, timeMargin, replaceFont) => {
    relGroup = group;
    fontSize = xFontSize > 0 ? xFontSize : 34; // 1em to pix
    tmMrg    = timeMargin ? timeMargin : 0; // 
    rFont    = replaceFont ? replaceFont : rFont;
    return convert(
        loadCSS(cssStr),
        loadVTT(vttStr)
    );
};
