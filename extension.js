import GObject from 'gi://GObject';
import St from 'gi://St';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.Button {
        _init() {
            super._init(0.0, _('My Shiny Indicator'));

            //Setting up the icon in the taskbar
            let iconPath = "/home/user/Documents/MusicPlaylistPC/Icon/music_icon.png";
            let gicon = Gio.icon_new_for_string(`${iconPath}`);
            let icon = new St.Icon({ gicon: gicon, style_class: 'system-status-icon', icon_size: 16 });
            this.add_child(icon);


            let downloadSongItem = new PopupMenu.PopupMenuItem(_('Download Current Song'));
            downloadSongItem.connect('activate', () => {
                this.downloadCurrentSong();
            });
            this.menu.addMenuItem(downloadSongItem);
        }

        downloadCurrentSong() {
            // Sorting data to get the song name and artist name from terminal
            function getSpotifyMetadata() {
                let [res, out, err, status] = [];
                [res, out, err, status] = GLib.spawn_command_line_sync("dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.freedesktop.DBus.Properties.Get string:org.mpris.MediaPlayer2.Player string:Metadata");
                return parseSpotifyData(out.toString());
            }
            
            function parseSpotifyData(data) {
                if (!data) return {title: null, artist: null};

                let titleBlock = data.substring(data.indexOf("xesam:title"));
                let title = titleBlock.split("\"")[2];

                let artistBlock = data.substring(data.indexOf("xesam:artist"));
                let artist = artistBlock.split("\"")[2];

                const MAX_STRING_LENGTH = 30;
                if (artist.length > MAX_STRING_LENGTH) {
                    artist = artist.substring(0, MAX_STRING_LENGTH) + "...";
                }
                if (title.length > MAX_STRING_LENGTH) {
                    title = title.substring(0, MAX_STRING_LENGTH) + "...";
                }

                return {title: title, artist: artist};
            }

            // Outputting current song name and artist name in the terminal
            let metadata = getSpotifyMetadata();
            if (metadata) {
                console.log(metadata.title + " by " + metadata.artist);
                searchYouTube(metadata);
            }

            //Calling for the youtube_search.js which uses Youtube API to get the Youtube URL
            function searchYouTube(metadata) {
                let command = [`node`, `/home/user/.local/share/gnome-shell/extensions/spotify@download.attempt/youtube_search.js`, `"${metadata.title} ${metadata.artist}"`]
                execCommunicate(command).then(out => {
                    console.log("Video URL: " + out)
                    downloadYouTubeAudio(out);
                })
            }

            //Downloads youtube audio using yt-dlp
            function downloadYouTubeAudio(videoUrl) {
                let command = [`yt-dlp`, `-x`,`-P`, `home:/home/user/Documents/MusicPlaylistPC`, `-o`, `${metadata.artist.replace(/ /g, '\ ')}\ -\ ${metadata.title.replace(/ /g, '\ ')}`, `-vU`,  `--audio-format`, `mp3`, `${videoUrl}`]
                execCheck(command).then(out => {
                    console.log(out)
                    console.log("Downloaded")
                    sendToPhone();
                }).catch(error => {
                    console.error(error);
                })
            }

            //Sends the downloaded file to the android device
            function sendToPhone() {
                let command2 = [`adb`, `push`, `/home/user/Documents/MusicPlaylistPC/${metadata.artist} - ${metadata.title}.mp3`, `./storage/emulated/0/Download/MusicPlaylist`]
                execCheck(command2).then(out2 => {
                    console.log(out2)
                    console.log("Downloaded and pushed to phone")
                    Main.notify('Spotify Music Downloader', 'Your song has been pushed to your phone. Enjoy!');
                }).catch(error2 => {
                    console.error(error2);
                })
            }


            function execCommunicate(argv) {
                let flags = (Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);

                let proc = Gio.Subprocess.new(argv, flags);

                return new Promise((resolve, reject) => {
                    proc.communicate_utf8_async(null, null, (proc, res) => {
                        try {
                            let [, stdout, stderr] = proc.communicate_utf8_finish(res);
                            let status = proc.get_exit_status();

                            console.log(stdout)

                            if (status !== 0) {
                                throw new Gio.IOErrorEnum({
                                    code: Gio.io_error_from_errno(status),
                                    message: stderr ? stderr.trim() : GLib.strerror(status)
                                });
                            }

                            resolve(stdout.trim());
                        } catch (e) {
                            reject(e);
                        }
                    });
                });
            }

            async function execCheck(argv, cancellable = null) {
                let cancelId = 0;
                const proc = new Gio.Subprocess({
                    argv,
                    flags: Gio.SubprocessFlags.NONE,
                });
                proc.init(cancellable);

                if (cancellable instanceof Gio.Cancellable)
                    cancelId = cancellable.connect(() => proc.force_exit());

                try {
                    const success = await proc.wait_check_async(null);

                    if (!success) {
                        const status = proc.get_exit_status();

                        throw new Gio.IOErrorEnum({
                            code: Gio.IOErrorEnum.FAILED,
                            message: `Command '${argv}' failed with exit code ${status}`,
                        });
                    }
                } finally {
                    if (cancelId > 0)
                        cancellable.disconnect(cancelId);
                }
            }
        }
    }
);
export default class MusicDownloaderExtension extends Extension {
    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea('music-downloader-indicator', this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}
