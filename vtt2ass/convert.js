#!/usr/bin/env node

// modules
const fs   = require('fs');
const vtt  = require('./../modules/module.vttconvert');
const yaml = require('../node_modules/yaml');

// converter const
const param = yaml.parse(
    fs.readFileSync('params.yaml','utf8')
);

// list files
const vttRegx   = /\.vtt$/;
const files     = filterByRegx(fs.readdirSync(param.folderVTT), vttRegx);

// filter
function filterByRegx(arr, regx) {
    return arr.filter(i=>{
        return i.match(new RegExp(regx));
    });
}

// convert
for(const f of files){
    const vttFile = param.folderVTT + f;
    const cssFile = param.folderVTT + f.replace(vttRegx, '.css');
    const assFile = param.folderASS + f.replace(vttRegx, '.ass');
    if( fs.existsSync(vttFile) && fs.existsSync(cssFile) ){
        const vttContent = fs.readFileSync(vttFile, 'utf8');
        const cssContent = fs.readFileSync(cssFile, 'utf8');
        console.log(`[INFO] Converting: ${f} ...`)
        const assContent = vtt(param.relTag, param.fontSize, vttContent, cssContent, param.timePad, param.rFont);
        fs.writeFileSync(assFile, assContent, 'utf8');
    }
}
