// 主应用程序
import {AudioController} from './modules/audioController.js';
import {PlaylistManager} from './modules/playlistManager.js';
import {UIManager} from './modules/uiManager.js';

class MusicPlayer {
    constructor() {
        this.audioController = new AudioController();
        this.playlistManager = new PlaylistManager();
        this.uiManager = new UIManager(this);

        this.init();
    }

    init() {
        // 初始化所有模块
        this.audioController.init(this);
        this.playlistManager.init(this);
        this.uiManager.init();

        // 加载初始播放列表
        this.loadInitialPlaylist();

        // 设置键盘快捷键
        this.setupKeyboardShortcuts();

        console.log('音乐播放器初始化完成');
    }

    async loadInitialPlaylist() {
        try {
            const response = await fetch('data/songs.json');
            const songs = await response.json();

            // 确保歌曲有ID
            songs.forEach(song => {
                if (song.id === undefined) {
                    song.id = this.getNextId(); // 但此时PlaylistManager尚未初始化，需用其他方式
                }
            });

            this.playlistManager.setPlaylist(songs);
            this.uiManager.updatePlaylistDisplay();
        } catch (error) {
            // 错误处理
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // 忽略输入框中的按键
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    this.audioController.togglePlay();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.playPrevious();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.playNext();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.audioController.increaseVolume();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.audioController.decreaseVolume();
                    break;
                case 'm':
                case 'M':
                    this.audioController.toggleMute();
                    break;
            }
        });
    }

    playSong(song) {
        this.audioController.playSong(song);
        this.uiManager.updateNowPlaying(song);
        this.playlistManager.addToRecentlyPlayed(song);
    }

    playNext() {
        const filteredSongs = this.playlistManager.getDisplayedSongs();
        const currentSong = this.getCurrentSong();
        if (currentSong) {
            // 找到当前歌曲在显示列表中的位置
            const currentIndex = filteredSongs.findIndex(s => s.id === currentSong.id);
            const nextIndex = (currentIndex + 1) % filteredSongs.length;
            const nextSong = filteredSongs[nextIndex];
            if (nextSong) {
                this.playSong(nextSong);
            }
        } else if (filteredSongs.length > 0) {
            // 如果没有当前歌曲，播放显示列表的第一首
            this.playSong(filteredSongs[0]);
        }
    }


    playPrevious() {
        const filteredSongs = this.playlistManager.getDisplayedSongs();
        const currentSong = this.getCurrentSong();
        if (currentSong) {
            // 找到当前歌曲在显示列表中的位置
            const currentIndex = filteredSongs.findIndex(s => s.id === currentSong.id);
            const prevIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : filteredSongs.length - 1;
            const prevSong = filteredSongs[prevIndex];
            if (prevSong) {
                this.playSong(prevSong);
            }
        } else if (filteredSongs.length > 0) {
            // 如果没有当前歌曲，播放显示列表的最后一首
            this.playSong(filteredSongs[filteredSongs.length - 1]);
        }
    }


    getCurrentSong() {
        return this.audioController.currentSong;
    }


}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    window.musicPlayer = new MusicPlayer();
});

export {MusicPlayer};