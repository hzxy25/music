class PlaylistManager {
    constructor() {
        this.playlist = [];
        this.currentIndex = -1;
        this.favorites = new Set();
        this.recentlyPlayed = [];
        this.MAX_RECENT = 10;
    }

    init(app) {
        this.app = app;
        this.loadFromLocalStorage();
        this.bindEvents();
    }

    bindEvents() {
        // 歌曲选择
        document.addEventListener('click', (e) => {
            const songRow = e.target.closest('.song-row');
            if (songRow && !e.target.classList.contains('select-song')) {
                const songId = parseInt(songRow.dataset.songId);
                this.playSongById(songId);
            }

            // 收藏按钮
            if (e.target.closest('#favorite-btn')) {
                const song = this.app.getCurrentSong();
                if (song) {
                    const isFavorite = this.toggleFavorite(song.id);
                    this.app.uiManager.updateFavoriteButton(isFavorite);
                }
            }
        });

        // 添加到收藏夹
        document.getElementById('select-all').addEventListener('change', (e) => {
            this.toggleSelectAll(e.target.checked);
        });

        // 清空播放列表
        document.getElementById('clear-playlist-btn').addEventListener('click', () => {
            if (confirm('确定要清空播放列表吗？')) {
                this.clearPlaylist();
            }
        });

        // 拖拽排序
        this.setupDragAndDrop();
    }

    setPlaylist(songs) {
        this.playlist = songs;
        this.saveToLocalStorage();
    }

    getPlaylist() {
        return this.playlist;
    }

    getNextSong() {
        if (this.playlist.length === 0) return null;

        let nextIndex;
        const mode = this.app.audioController.playbackMode;

        switch (mode) {
            case 'shuffle':
                nextIndex = Math.floor(Math.random() * this.playlist.length);
                break;
            case 'repeat-one':
                nextIndex = this.currentIndex;
                break;
            case 'order':
            default:
                nextIndex = (this.currentIndex + 1) % this.playlist.length;
                break;
        }

        return this.playlist[nextIndex];
    }

    getPreviousSong() {
        if (this.playlist.length === 0) return null;

        let prevIndex;
        const mode = this.app.audioController.playbackMode;

        switch (mode) {
            case 'shuffle':
                prevIndex = Math.floor(Math.random() * this.playlist.length);
                break;
            case 'repeat-one':
                prevIndex = this.currentIndex;
                break;
            case 'order':
            default:
                prevIndex = this.currentIndex - 1;
                if (prevIndex < 0) prevIndex = this.playlist.length - 1;
                break;
        }

        return this.playlist[prevIndex];
    }

    playSongById(songId) {
        const songIndex = this.playlist.findIndex(song => song.id === songId);
        if (songIndex !== -1) {
            this.currentIndex = songIndex;
            const song = this.playlist[songIndex];
            this.app.playSong(song);
        }
    }

    addToRecentlyPlayed(song) {
            if (!song) return;

            console.log('添加到最近播放:', song.title);

            // 移除重复项（基于歌曲ID）
            this.recentlyPlayed = this.recentlyPlayed.filter(item => item.id !== song.id);

            // 添加到开头
            this.recentlyPlayed.unshift(song);

            // 限制数量
            if (this.recentlyPlayed.length > this.MAX_RECENT) {
                this.recentlyPlayed = this.recentlyPlayed.slice(0, this.MAX_RECENT);
            }

            console.log('更新后最近播放列表:', this.recentlyPlayed);

            // 更新UI
            if (this.app && this.app.uiManager) {
                this.app.uiManager.updateRecentlyPlayedDisplay();
            }

            // 保存到本地存储
            this.saveToLocalStorage();
        }


    toggleFavorite(songId) {
        if (this.favorites.has(songId)) {
            this.favorites.delete(songId);
            return false;
        } else {
            this.favorites.add(songId);
            return true;
        }
    }

    addSong(song) {
        // 生成新ID
        const newId = this.playlist.length > 0
            ? Math.max(...this.playlist.map(s => s.id)) + 1
            : 1;

        song.id = newId;
        this.playlist.push(song);

        this.app.uiManager.updatePlaylist(this.playlist);
        this.saveToLocalStorage();

        return song;
    }

    removeSong(songId) {
        this.playlist = this.playlist.filter(song => song.id !== songId);
        this.app.uiManager.updatePlaylist(this.playlist);
        this.saveToLocalStorage();
    }

    clearPlaylist() {
        this.playlist = [];
        this.currentIndex = -1;
        this.app.audioController.pause();
        this.app.audioController.currentSong = null;
        this.app.uiManager.updatePlaylist([]);
        this.app.uiManager.updateNowPlaying(null);
        this.saveToLocalStorage();
    }

    setupDragAndDrop() {
        const playlistBody = document.getElementById('playlist-body');

        playlistBody.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('song-row')) {
                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', e.target.dataset.songId);
            }
        });

        playlistBody.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingItem = document.querySelector('.dragging');
            const afterElement = this.getDragAfterElement(playlistBody, e.clientY);

            if (afterElement == null) {
                playlistBody.appendChild(draggingItem);
            } else {
                playlistBody.insertBefore(draggingItem, afterElement);
            }
        });

        playlistBody.addEventListener('dragend', (e) => {
            const draggedElement = e.target;
            draggedElement.classList.remove('dragging');

            // 更新播放列表顺序
            const newPlaylist = [];
            const rows = playlistBody.querySelectorAll('.song-row');
            rows.forEach(row => {
                const songId = parseInt(row.dataset.songId);
                const song = this.playlist.find(s => s.id === songId);
                if (song) newPlaylist.push(song);
            });

            this.playlist = newPlaylist;
            this.saveToLocalStorage();
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.song-row:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    toggleSelectAll(checked) {
        const checkboxes = document.querySelectorAll('.select-song');
        checkboxes.forEach(checkbox => {
            checkbox.checked = checked;
        });
    }

    getSelectedSongs() {
        const selectedIds = [];
        document.querySelectorAll('.select-song:checked').forEach(checkbox => {
            selectedIds.push(parseInt(checkbox.value));
        });
        return selectedIds;
    }

    // 本地存储
    saveToLocalStorage() {
            const data = {
                playlist: this.playlist,
                favorites: Array.from(this.favorites),
                recentlyPlayed: this.recentlyPlayed, // 直接保存最近播放的歌曲对象
                volume: this.app.audioController.volume,
                playbackMode: this.app.audioController.playbackMode
            };

            localStorage.setItem('musicPlayerData', JSON.stringify(data));
        }

    loadFromLocalStorage() {
            try {
                const data = JSON.parse(localStorage.getItem('musicPlayerData'));
                if (data) {
                    this.playlist = data.playlist || [];
                    this.favorites = new Set(data.favorites || []);

                    // 修改：正确加载最近播放数据
                    if (data.recentlyPlayed && Array.isArray(data.recentlyPlayed)) {
                        this.recentlyPlayed = data.recentlyPlayed;
                    } else {
                        this.recentlyPlayed = [];
                    }

                    console.log('从本地存储加载的最近播放:', this.recentlyPlayed);

                    if (data.volume) {
                        this.app.audioController.setVolume(data.volume);
                    }
                    if (data.playbackMode) {
                        this.app.audioController.setPlaybackMode(data.playbackMode);
                    }
                }
            } catch (error) {
                console.error('加载本地存储数据失败:', error);
            }
        }
}

export { PlaylistManager };