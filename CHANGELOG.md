## Change Log

### 1.11.0 (2019/08/12)
- Updated `module.vttconvert` module, improved css parsing

### 1.10.0 (2019/08/07)
- Added `rfont` option for font replacing in subtitles

### 1.9.4 (2019/08/01)
- Fix downloading premium videos (Closes #16)

### 1.9.3 (2019/07/29)
- Api key updated (Closes #14)

### 1.9.2 (2019/07/27)
- New api key required for using this application
- Updated `module.vttconvert` module

### 1.9.1-broken (2019/06/25)
- App is broken, see: seiya-dev/hidive-downloader-nx#14

### 1.9.0 (2019/06/16)
- Api keys updated to newer version (Closes #12)
- update modules

### 1.8.0 (2019/05/03)
- replace `request` module with `got`
- changed proxy cli options
- changed `login` option name to `auth`
- moved api constants to `module.apiclient.json`
- moved language list to `module.langs.json`
- update modules

### 1.7.2 (2019/03/17)
- Fix subtitles downloading (Closes #7, #8)

### 1.7.1 (2019/02/09)
- Fix saving `.ass` file in standalone `vtt2ass` script (thanks to @arisudesu)
- Fix muxing with subtitles (Closes #6)

### 1.7.0 (2019/01/25)
- Improved conversion VTT+CSS to ASS, ASS style names are same as in CSS and merged
- Separate script for conversion VTT+CSS to ASS locally in `vtt2ass` folder

### 1.5.0 (2019/01/24)
- Added new option `caps` — Mux caption subs only for non-Japanese dub / Mux full subs only for Japanese dub
- Added new option `ftag` — Custom title tag in muxed file info (thanks to @Golumpa, closes #3)
- Added new options to configuration file
- Fixed path to `vttconvert` module (Closes #4)

### 1.4.0 (2019/01/23)
- Improved conversion VTT+CSS to ASS, ASS style names are same as in CSS

### 1.3.0 (2018/12/07)
- Improved episode selection and file naming
- `hls-download` configuration changed, split download to 10 pieces instead of 5

### 1.2.1 (2018/12/06)
- Fix broken subtitles parsing

### 1.2.0 (2018/12/05)
- Select episodes by hyphen-sequence

### 1.1.1 (2018/12/04)
- Fixed VTT+CSS parsing with some subtitles

### 1.1.0 (2018/12/01)
- `stag` option for subtitles, updated configuration file
- Removed `dateformat` module

### 1.0.0 (2018/11/30)
- First public release
