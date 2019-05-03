## Change Log

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
