// modules
const fs = require('fs');
const path = require('path');

// const
const cssPrefixRx = /\.rmp-container>\.rmp-content>\.rmp-cc-area>\.rmp-cc-container>\.rmp-cc-display>\.rmp-cc-cue /g;
const pfxSubStyle = 'SubMain';

// colors
const colors = require(path.join(__dirname, 'module.colors'));

// predefined
let relGroup = '';
let fontSize = 0;
let tmMrg    = 0;

function loadCSS(cssStr) {
    let css = cssStr; // fs.readFileSync(name, 'utf8');
    css = css.replace(cssPrefixRx, '').replace(/[\r\n]+/g, '\n').split('\n');
    let styles = {
        Default: `Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,1,0,2,20,20,20,1`,
    };
    let map = {};
    for (let i in css) {
        let cls;
        let l = css[i];
        if (l === '') continue;
        let m = l.match(/^(.*)\{(.*)\}$/);
        if (!m) throw new Error(`Invalid css in line ${i}: ${l}`);
        if (m[1] === '') {
            cls = 'Default';
        } else {
            cls = pfxSubStyle + i;
            m[1].replace(/\./g, '').split(',').forEach(x => map[x] = cls);
        }
        styles[cls] = parseStyle(m[2], styles['Default']);
    }
    return { styles, map };
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
                style[0] = st[1].match(/[\s"]*([^",]*)/)[1];
                break;
            case 'font-size':
                style[1] = getPxSize(st[1]);
                break;
            case 'color':
                cl = getColor(st[1]);
                if (cl !== null) {
                    if (cl=='&H0000FFFF'){
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
                if(st[1] === '1px 1px black, -1px -1px black, 1px -1px black, -1px 1px black, 0px 1px black, 1px 0px black'){
                    style[16] = 1;
                    break;
                }
            default:
                console.error(`[WARN] VTT2SRT: Unknown style: ${s.trim()}`);
        }
    }

    return style.join(',');
}

function getPxSize(size) {
    let m = size.trim().match(/([\d.]+)(.*)/);
    if (!m) throw new Error(`Unknown size: ${size}`);
    if (m[2] === 'em') m[1] *= fontSize;
    return Math.round(m[1]);
}

function getColor(c) {
    if (c[0] !== '#') {
        c = colors[c];
    } else if (c.length < 7) {
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
                },
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
    let ass = [
        '\ufeff[Script Info]',
        'Title: '+relGroup,
        'ScriptType: v4.00+',
        'WrapStyle: 0',
        'PlayResX: 1280',
        'PlayResY: 720',
        '',
        '[V4+ Styles]',
        'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    ];
    
    // delete css.styles.Default;
    // ass.push('Style: Default,Open Sans Semibold,48,&H00FFFFFF,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,20,20,20,1');
    // ass.push('Style: Default-Alt,Open Sans Semibold,48,&H00FFFFFF,&H00000000,&H008A2B2A,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,20,20,20,1');
    // ass.push('Style: Caption,Open Sans Semibold,48,&H00FFFFFF,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,20,20,20,1');
    // ass.push('Style: Caption-wBorder,Open Sans Semibold,48,&H00FFFFFF,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,5,2,2,20,20,20,1');
    
    for (let s in css.styles) {
        ass.push(`Style: ${s},${css.styles[s]}`);
    }
    
    ass = ass.concat([
        '',
        '[Events]',
        'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ]);
    
    let events = {
        subtitle: [],
        caption: [],
        capt_pos: [],
        song_cap: [],
    };

    let linesMap = {};
    for (let l of vtt) {
        // console.log(l);
        let x = convertLine(css, l);
        if (x.ind !== '' && linesMap[x.ind] !== undefined) {
            events[x.type][linesMap[x.ind]] += '\\N' + x.text;
        } else {
            events[x.type].push(x.res);
            if (x.ind !== '') {
                linesMap[x.ind] = events[x.type].length - 1;
            }
        }
    }

    return ass.concat(
        'Comment: 0,0:00:00.00,0:00:00.00,Default,,0,0,0,,** Subtitles **',
        events.subtitle,
        'Comment: 0,0:00:00.00,0:00:00.00,Default,,0,0,0,,** Captions **',
        events.caption,
        'Comment: 0,0:00:00.00,0:00:00.00,Default,,0,0,0,,** Captions with position **',
        events.capt_pos,
        'Comment: 0,0:00:00.00,0:00:00.00,Default,,0,0,0,,** Song captions **',
        events.song_cap
    ).join('\r\n') + '\r\n';
}

function convertLine(css, l) {
    let start = convertTime(l.time.start);
    let end = convertTime(l.time.end);
    let txt = convertText(l.text);
    let type = txt.style.match(/Caption/) ? 'caption' : (txt.style.match(/SongCap/) ? 'song_cap' : 'subtitle');
    type = type == 'caption' && l.time.ext.position !== undefined ? 'capt_pos' : type;
    
    if (l.time.ext.align === 'left') {
        txt.text = `{\\an7}${txt.text}`;
    }

    let ind = '';
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
        indregx = txt.style.match(/(.*)_\d+/);
        if(indregx !== null){
            ind = indregx[1];
        }
    }

    let style = css.map[txt.style] || 'Default';
    let res = `Dialogue: 0,${start},${end},${style},,0,0,0,,${txt.text}`;
    return { res, type, ind, text: txt.text };
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

    return { style, xtext };
}

function convertTime(tm) {
    let m = tm.match(/([\d:]*)\.?(\d*)/);
    if (!m) return '0:00:00.00';
    return toSubTime(m[0]);
}

function toSubTime(str) {
    let n = [], x, sx, s; // tmMrg = 0;
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

module.exports = (group, xFontSize, vttStr, cssStr, timeMargin) => {
    relGroup = group;
    fontSize = xFontSize > 34 ? xFontSize : 34; // 1em to pix
    tmMrg = timeMargin ? timeMargin : 0;
    return convert(
        loadCSS(cssStr),
        loadVTT(vttStr)
    );
};
