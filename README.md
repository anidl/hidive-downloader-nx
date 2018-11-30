# HIDIVE Downloader NX

HIDIVE Downloader NX is capable of downloading videos from the *HIDIVE* streaming service.

## Legal Warning

This application is not endorsed by or affiliated with *HIDIVE*. This application enables you to download videos for offline viewing which may be forbidden by law in your country. The usage of this application may also cause a violation of the *Terms of Service* between you and the stream provider. This tool is not responsible for your actions; please make an informed decision before using this application.

## Prerequisites

* NodeJS >= 9.4.0 (https://nodejs.org/)
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

* `--login` enter login mode

### Get Show ID

* `--search <s>` sets the show title for search

### Download Video

* `-s <i> -e <s>` sets the show id and episode ids (comma-separated)
* `-q <i>` sets the video quality [360p, 480p, 720p, 1080p]
* `--dub` select dub language [eng, jpn, ...] (eng dub by default)
* `--br` force download broadcast version
* `--nosubs` skip download subtitles for non-japanese dub (if available)

### Proxy

* `--socks <s>` set ipv4 socks5 proxy for all requests to HIDIVE api
* `--socks-login <s>` set username for socks5 proxy
* `--socks-pass <s>`  set password for socks5 proxy
* `--proxy <s>` set ipv4 http(s) proxy for all requests to HIDIVE api
* `--ssp` don't use proxy for stream downloading

### Muxing

`[note] this application mux into mkv by default`
* `--mp4` mux into mp4
* `--mks` add subtitles to mkv (if available)

### Filenaming (optional)

* `-a <s>` release group ("HIDIVE" by default)
* `-t <s>` show title override
* `--ep <s>` episode number override (ignored in batch mode)
* `--suffix <s>` filename suffix override (first "SIZEp" will be replaced with actual video size, "SIZEp" by default)

### Utility

* `--nocleanup` move unnecessary files to trash folder after completion instead of deleting
* `-h`, `--help` show all options

## Filename Template

[`release group`] `title` - `episode` [`suffix`].`extension`

## CLI Examples

* `node hidive --search "K-ON"` search "K-ON" in title
* `node hidive -s 125 -e s01e001,s01e002` download episodes s01e001-s01e002 from show with id 125
* `node hidive -s 337 -e 2011120301` download episode 2011120301 from show with id 337

`[note] movies and ovas have episode number as air date`
