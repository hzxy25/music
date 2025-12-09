// 主应用程序
import { AudioController } from './modules/audioController.js';
import { PlaylistManager } from './modules/playlistManager.js';
import { UIManager } from './modules/uiManager.js';

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
                this.playlistManager.setPlaylist(songs);
                this.uiManager.updatePlaylistDisplay();

                // 确保UI更新后显示正确的筛选状态
                console.log('播放列表加载完成，当前筛选器:', this.uiManager.currentFilter);
            } catch (error) {
                console.error('加载播放列表失败:', error);
                // 使用默认播放列表
                const defaultSongs = [
                    {
                        id: 1,
                        title: "示例歌曲",
                        artist: "示例艺术家",
                        duration: "3:45",
                        src: "assets/songs/sample.mp3",
                        cover: "assets/covers/default.jpg",
                        lyrics: "assets/lyrics/sample.lrc"
                    }
                ];
                this.playlistManager.setPlaylist(defaultSongs);
                this.uiManager.updatePlaylistDisplay();
            }
        }


    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // 忽略输入框中的按键
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch(e.key) {
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
        const nextSong = this.playlistManager.getNextSong();
        if (nextSong) {
            this.playSong(nextSong);
        }
    }

    playPrevious() {
        const prevSong = this.playlistManager.getPreviousSong();
        if (prevSong) {
            this.playSong(prevSong);
        }
    }

    toggleFavorite(songId) {
        return this.playlistManager.toggleFavorite(songId);
    }

    getCurrentSong() {
        return this.audioController.currentSong;
    }

    getPlaylist() {
        return this.playlistManager.getPlaylist();
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    window.musicPlayer = new MusicPlayer();
});

export { MusicPlayer };