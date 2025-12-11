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


    getNextId() {
        if (this.playlist.length === 0) {
            return 1;
        }
        return Math.max(...this.playlist.map(s => s.id)) + 1;
    }


    setPlaylist(songs) {
        // 确保所有歌曲都有ID
        songs.forEach(song => {
            if (song.id === undefined) {
                song.id = this.getNextId();
            }
        });

        this.playlist = songs;
        this.saveToLocalStorage();
    }

    getPlaylist() {
        return this.playlist;
    }

    getNextSong() {
        if (this.playlist.length === 0) return null;

        // 获取当前显示的歌曲列表（考虑筛选状态）
        const displayedSongs = this.getDisplayedSongs();

        // 如果当前歌曲不在显示列表中，返回列表第一首
        if (this.currentIndex === -1) {
            return displayedSongs[0];
        }

        const currentSong = this.playlist[this.currentIndex];
        const currentSongId = currentSong ? currentSong.id : null;

        // 找到当前歌曲在显示列表中的位置
        const currentDisplayIndex = displayedSongs.findIndex(s => s.id === currentSongId);

        if (currentDisplayIndex === -1) {
            // 当前歌曲不在显示列表中，返回第一首
            return displayedSongs[0];
        }

        let nextIndex;
        const mode = this.app.audioController.playbackMode;

        switch (mode) {
            case 'shuffle':
                nextIndex = Math.floor(Math.random() * displayedSongs.length);
                break;
            case 'repeat-one':
                nextIndex = currentDisplayIndex;
                break;
            case 'order':
            default:
                nextIndex = (currentDisplayIndex + 1) % displayedSongs.length;
                break;
        }

        // 返回显示列表中的歌曲，但需要从主播放列表中找到完整歌曲对象
        const nextDisplaySong = displayedSongs[nextIndex];
        return this.playlist.find(song => song.id === nextDisplaySong.id);
    }


    getPreviousSong() {
        if (this.playlist.length === 0) return null;

        // 获取当前显示的歌曲列表
        const displayedSongs = this.getDisplayedSongs();

        // 如果当前歌曲不在显示列表中，返回列表最后一首
        if (this.currentIndex === -1) {
            return displayedSongs[displayedSongs.length - 1];
        }

        const currentSong = this.playlist[this.currentIndex];
        const currentSongId = currentSong ? currentSong.id : null;

        // 找到当前歌曲在显示列表中的位置
        const currentDisplayIndex = displayedSongs.findIndex(s => s.id === currentSongId);

        if (currentDisplayIndex === -1) {
            // 当前歌曲不在显示列表中，返回最后一首
            return displayedSongs[displayedSongs.length - 1];
        }

        let prevIndex;
        const mode = this.app.audioController.playbackMode;

        switch (mode) {
            case 'shuffle':
                prevIndex = Math.floor(Math.random() * displayedSongs.length);
                break;
            case 'repeat-one':
                prevIndex = currentDisplayIndex;
                break;
            case 'order':
            default:
                prevIndex = currentDisplayIndex - 1;
                if (prevIndex < 0) prevIndex = displayedSongs.length - 1;
                break;
        }

        // 返回显示列表中的歌曲，但需要从主播放列表中找到完整歌曲对象
        const prevDisplaySong = displayedSongs[prevIndex];
        return this.playlist.find(song => song.id === prevDisplaySong.id);
    }

// 添加新方法：获取当前显示的歌曲列表
    getDisplayedSongs() {
        const currentFilter = this.app.uiManager.currentFilter;

        switch (currentFilter) {
            case 'favorites':
                // 收藏歌曲：从播放列表中筛选出收藏的歌曲，保持原始顺序
                return this.playlist.filter(song => this.favorites.has(song.id));

            case 'recent':
                // 最近播放：按最近播放时间排序
                const recentIds = this.recentlyPlayed.map(item => item.id);
                return this.playlist
                    .filter(song => recentIds.includes(song.id))
                    .sort((a, b) => {
                        const aIndex = recentIds.indexOf(a.id);
                        const bIndex = recentIds.indexOf(b.id);
                        return aIndex - bIndex;
                    });

            case 'all':
            default:
                // 所有歌曲：返回整个播放列表（已经考虑了拖动排序）
                return [...this.playlist];
        }
    }

// 修改 playSongById 方法，确保正确设置 currentIndex
    playSongById(songId) {
        const songIndex = this.playlist.findIndex(song => song.id === songId);
        if (songIndex !== -1) {
            this.currentIndex = songIndex;
            const song = this.playlist[songIndex];
            this.app.playSong(song);

            // 更新 UI 管理器当前显示的歌单（如果是在筛选视图播放）
            if (this.app.uiManager.currentFilter !== 'all') {
                // 确保歌曲在筛选视图中，否则切换到所有歌曲视图
                const displayedSongs = this.getDisplayedSongs();
                const isInDisplayed = displayedSongs.some(s => s.id === songId);
                if (!isInDisplayed) {
                    // 如果在筛选视图中点击了不在该视图的歌曲，切换到所有歌曲视图
                    this.app.uiManager.setFilter('all');
                }
            }
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

            // 获取当前筛选状态
            const currentFilter = this.app.uiManager.currentFilter;

            // 只有在"所有歌曲"或"收藏歌曲"视图下才更新播放列表顺序
            if (currentFilter === 'all' || currentFilter === 'favorites') {
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

                // 如果是收藏视图，重新刷新显示以保持一致性
                if (currentFilter === 'favorites') {
                    this.app.uiManager.updatePlaylistDisplay();
                }
            }
        });
    }


    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.song-row:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return {offset: offset, element: child};
            } else {
                return closest;
            }
        }, {offset: Number.NEGATIVE_INFINITY}).element;
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

export {PlaylistManager};