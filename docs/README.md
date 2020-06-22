# HIDIVE Downloader NX

HIDIVE Downloader NX is capable of downloading videos from the *HIDIVE* streaming service.
Api key required for using this application.

## Legal Warning

This application is not endorsed by or affiliated with *HIDIVE*. This application enables you to download videos for offline viewing which may be forbidden by law in your country. The usage of this application may also cause a violation of the *Terms of Service* between you and the stream provider. This tool is not responsible for your actions; please make an informed decision before using this application.

## Prerequisites

* NodeJS >= 12.2.0 (https://nodejs.org/)
* NPM >= 5.3.0 (https://www.npmjs.org/)
* ffmpeg >= 4.0.0 (https://www.videohelp.com/software/ffmpeg)
* MKVToolNix >= 20.0.0 (https://www.videohelp.com/software/MKVToolNix)

### Paths Configuration

By default this application uses the following paths to programs (main executables):
* `./modules/mkvtoolnix/mkvmerge`
* `./modules/ffmpeg`

To change these paths you need to edit `config.main.yml` in `./modules/` directory.

### Node Modules

After installing NodeJS with NPM go to directory with `package.json` file and type: `npm i`.
* [check dependencies](https://david-dm.org/seiya-dev/hidive-downloader-nx)

## CLI Options

### Authentication

* `--auth` enter auth mode

### Get Show ID

* `--search <s>` sets the show title for search

### Download Video

* `-s <i> -e <s>` sets the show id and episode ids (comma-separated, hyphen-sequence)
* `-q <s>` sets the video quality [360p, 480p, 720p, 1080p]
* `--dub` select dub language [eng, jpn, ...] (eng dub by default)
* `--br` force download broadcast version
* `--nosubs` skip download subtitles for non-japanese dub (if available)

### Proxy

* `--proxy <s>` http(s)/socks proxy WHATWG url (ex. https://myproxyhost:1080)
* `--proxy-auth <s>` Colon-separated username and password for proxy
* `--ssp` don't use proxy for stream downloading

### Muxing

`[note] this application mux into mkv by default`
* `--mp4` mux into mp4
* `--mks` add subtitles to mkv (if available)
* `--caps` mux only caption subs for non-Japanese dub

### Filenaming (optional)

* `-a <s>` release group (title tag) ("HIDIVE" by default)
* `-t <s>` show title override
* `--ep <s>` episode number override (ignored in batch mode)
* `--suffix <s>` filename suffix override (first "SIZEp" will be replaced with actual video size, "SIZEp" by default)

### Utility

* `--stag` custom title tag in subtitle file (override `-a` option)
* `--rfont` Replace all default fonts with custom font in subtitle file
* `--ftag` custom title tag in muxed file info (override `-a` option)
* `--nocleanup` move unnecessary files to trash folder after completion instead of deleting
* `-h`, `--help` show all options

## Filename Template

[`release group`] `title` - `episode` [`suffix`].`extension`

## CLI Examples

* `node hidive --search "K-ON"` search "K-ON" in title
* `node hidive -s 125 -e s01e001,s01e002` download episodes s01e001 and s01e002 from show with id 125
* `node hidive -s 337 -e ova01` download episode ova01 from show with id 337
* `node hidive -s 125 -e s01e003-005,ova01` download episodes s01e003-005 and ova01 from show with id 125
* `node hidive -s 125 -e ova01-07` download episodes ova01-07 from show with id 125
* `node hidive -s 125 -e movie03` download episodes movie03 from show with id 125
* `node hidive -s 125 -e movie01-02` download episodes movie01-02 from show with id 125
