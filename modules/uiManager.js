class UIManager {
    constructor(app) {
        this.app = app;
        this.currentLyrics = [];
        this.isLyricsVisible = true;
        this.autoScrollEnabled = true;
        this.autoScrollTimer = null;
        this.userManuallyScrolled = false;
        this.currentFilter = 'all';
        this.selectedSongs = new Set();
        this.lastManualScrollTime = 0;
    }

    init() {
        this.bindEvents();
        this.updateTheme();
        this.setupScrollDetection();
        this.userManuallyScrolled = false;

        // 初始化批量操作工具栏为隐藏
        document.getElementById('batch-toolbar').classList.remove('visible');
    }

    bindEvents() {
        // 主题切换
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // 背景模糊切换
        document.getElementById('blur-toggle').addEventListener('click', () => {
            this.toggleBackgroundBlur();
        });

        // 可视化切换
        document.getElementById('visualizer-toggle').addEventListener('click', () => {
            this.toggleVisualizer();
        });

        // 歌词显示/隐藏
        document.getElementById('toggle-lyrics').addEventListener('click', () => {
            this.toggleLyrics();
        });

        // 自动滚动切换
        document.getElementById('toggle-auto-scroll').addEventListener('click', (e) => {
            this.toggleAutoScroll(e.currentTarget);
        });

        // 列表筛选
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.currentTarget.dataset.filter;
                this.setFilter(filter);
            });
        });

        // 全选复选框
        document.getElementById('select-all').addEventListener('change', (e) => {
            this.toggleSelectAll(e.target.checked);
        });

        // 批量操作按钮
        document.getElementById('batch-favorite-btn').addEventListener('click', () => {
            this.batchFavorite();
        });

        document.getElementById('batch-unfavorite-btn').addEventListener('click', () => {
            this.batchUnfavorite();
        });

        document.getElementById('clear-selection-btn').addEventListener('click', () => {
            this.clearSelection();
        });

        // 模态框
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeAllModals();
            });
        });

        document.getElementById('add-song-btn').addEventListener('click', () => {
            this.openModal('upload-modal');
        });

        // 文件上传
        document.getElementById('upload-btn').addEventListener('click', () => {
            this.handleFileUpload();
        });

        // 均衡器控制
        document.querySelectorAll('.eq-range').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const band = e.target.dataset.band;
                const value = e.target.value;
                this.app.audioController.updateEQ(band, value);
            });
        });

        // 点击背景关闭模态框
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAllModals();
            }
        });

        // 触摸滑动支持
        this.setupTouchEvents();

        // 初始化播放模式按钮
        this.initPlayModeButtons();
    }

    // 在UIManager类中的init方法中修改：
    initPlayModeButtons() {
        document.querySelectorAll('.playback-mode .mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.currentTarget.dataset.mode;
                this.app.audioController.setPlaybackMode(mode);
                this.app.playlistManager.saveToLocalStorage();
            });
        });
    }

    setFilter(filter) {
        this.currentFilter = filter;

        // 更新按钮状态
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        // 更新播放列表显示
        this.updatePlaylistDisplay();

        // 清除选择
        this.clearSelection();
    }

    updatePlaylistDisplay() {
        const playlist = this.app.playlistManager.getPlaylist();
        const favorites = this.app.playlistManager.favorites;
        const recentlyPlayed = this.app.playlistManager.recentlyPlayed;

        let filteredSongs = [];

        switch (this.currentFilter) {
            case 'favorites':
                filteredSongs = playlist.filter(song => favorites.has(song.id));
                // 保持收藏歌曲的顺序与主播放列表一致
                filteredSongs.sort((a, b) => {
                    const aIndex = playlist.findIndex(s => s.id === a.id);
                    const bIndex = playlist.findIndex(s => s.id === b.id);
                    return aIndex - bIndex;
                });
                break;
            case 'recent':
                // 获取最近播放的歌曲
                const recentIds = recentlyPlayed.map(item => item.id);
                filteredSongs = playlist.filter(song => recentIds.includes(song.id));

                // 按最近播放时间排序
                filteredSongs.sort((a, b) => {
                    const aIndex = recentIds.indexOf(a.id);
                    const bIndex = recentIds.indexOf(b.id);
                    return aIndex - bIndex;
                });
                break;
            case 'all':
            default:
                filteredSongs = [...playlist]; // 复制数组以保持拖动排序后的顺序
                break;
        }

        // 保存当前显示的歌曲列表供上下首切换使用
        this.currentFilteredSongs = filteredSongs;

        this.updatePlaylist(filteredSongs);

        this.currentFilteredSongs = filteredSongs;
        console.log('更新显示歌曲列表:', filteredSongs.length, '首歌曲');

        this.updatePlaylist(filteredSongs);
    }

    updatePlaylist(songs) {
        const playlistBody = document.getElementById('playlist-body');
        playlistBody.innerHTML = '';

        // 如果歌曲列表为空，显示提示
        if (songs.length === 0) {
            playlistBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-secondary)">
                        <i class="fas fa-music" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
                        ${this.currentFilter === 'favorites' ? '暂无收藏歌曲' :
                this.currentFilter === 'recent' ? '暂无最近播放记录' :
                    '播放列表为空'}
                    </td>
                </tr>
            `;
            return;
        }

        songs.forEach((song, index) => {
            const row = document.createElement('tr');
            row.className = 'song-row';
            row.dataset.songId = song.id;
            row.draggable = true; // 确保所有歌曲行都可拖动

            // 如果是当前播放的歌曲，添加特殊样式
            if (this.app.audioController.currentSong?.id === song.id) {
                row.classList.add('playing');
            }

            // 如果是选中的歌曲，添加选中样式
            if (this.selectedSongs.has(song.id)) {
                row.classList.add('selected');
            }

            // 判断是否为收藏歌曲
            const isFavorite = this.app.playlistManager.favorites.has(song.id);

            row.innerHTML = `
        <td>
            <input type="checkbox" class="select-song" value="${song.id}" 
                   ${this.selectedSongs.has(song.id) ? 'checked' : ''}>
        </td>
        <!-- 移除序号单元格 -->
        <td>
            <div class="song-info-mini">
                <img src="${song.cover || 'assets/covers/default.jpg'}" 
                     alt="封面" 
                     class="mini-cover"
                     onerror="this.src='assets/covers/default.jpg'">
                <div>
                    <strong>${song.title}</strong>
                    ${isFavorite ?
                '<i class="fas fa-heart favorite-icon" style="color: #ff4757; margin-left: 5px;"></i>' : ''}
                </div>
            </div>
        </td>
        <td>${song.artist}</td>
        <td>${song.duration || '0:00'}</td>
        <td>
            <button class="btn-icon favorite-action" data-song-id="${song.id}" title="${isFavorite ? '取消收藏' : '收藏'}">
                <i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i>
            </button>
            <button class="btn-icon remove-song" data-song-id="${song.id}" title="删除">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;

            // 歌曲点击事件
            row.addEventListener('click', (e) => {
                // 如果点击的是复选框或收藏按钮，不触发播放
                if (e.target.classList.contains('select-song') ||
                    e.target.classList.contains('favorite-action') ||
                    e.target.closest('.favorite-action') ||
                    e.target.classList.contains('remove-song') ||
                    e.target.closest('.remove-song')) {
                    return;
                }
                this.app.playlistManager.playSongById(song.id);
            });

            // 复选框点击事件
            const checkbox = row.querySelector('.select-song');
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleSongSelection(song.id, checkbox.checked);
            });

            // 收藏按钮点击事件
            const favoriteBtn = row.querySelector('.favorite-action');
            favoriteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const songId = parseInt(e.currentTarget.dataset.songId);
                const isFavorite = this.app.playlistManager.toggleFavorite(songId);
                this.updateFavoriteIcon(e.currentTarget, isFavorite);

                // 如果当前是收藏歌曲筛选，更新列表
                if (this.currentFilter === 'favorites') {
                    this.updatePlaylistDisplay();
                }

                this.updateBatchToolbar();
            });

            // 删除按钮点击事件
            const removeBtn = row.querySelector('.remove-song');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const songId = parseInt(e.currentTarget.dataset.songId);
                if (confirm('确定要删除这首歌吗？')) {
                    this.app.playlistManager.removeSong(songId);
                    this.selectedSongs.delete(songId);
                    this.updatePlaylistDisplay();
                }
            });

            playlistBody.appendChild(row);
        });

        this.updateBatchToolbar();
    }

    toggleSongSelection(songId, checked) {
        if (checked) {
            this.selectedSongs.add(songId);
        } else {
            this.selectedSongs.delete(songId);
        }

        // 更新行样式
        const row = document.querySelector(`.song-row[data-song-id="${songId}"]`);
        if (row) {
            row.classList.toggle('selected', checked);
        }

        this.updateBatchToolbar();
    }

    toggleSelectAll(checked) {
        const visibleRows = document.querySelectorAll('.song-row:not([style*="display: none"])');
        const checkboxes = document.querySelectorAll('.select-song:not([style*="display: none"])');

        if (checked) {
            // 只选择当前可见的歌曲
            visibleRows.forEach(row => {
                const songId = parseInt(row.dataset.songId);
                this.selectedSongs.add(songId);
                row.classList.add('selected');
            });

            checkboxes.forEach(checkbox => {
                checkbox.checked = true;
            });
        } else {
            // 只取消选择当前可见的歌曲
            visibleRows.forEach(row => {
                const songId = parseInt(row.dataset.songId);
                this.selectedSongs.delete(songId);
                row.classList.remove('selected');
            });

            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
        }

        this.updateBatchToolbar();
    }

    updateBatchToolbar() {
        const toolbar = document.getElementById('batch-toolbar');
        const countElement = document.getElementById('selected-count');
        const selectAllCheckbox = document.getElementById('select-all');

        countElement.textContent = this.selectedSongs.size;

        if (this.selectedSongs.size > 0) {
            toolbar.classList.add('visible');
        } else {
            toolbar.classList.remove('visible');
        }

        // 更新全选复选框状态
        const visibleCheckboxes = document.querySelectorAll('.select-song:not([style*="display: none"])');
        const allChecked = visibleCheckboxes.length > 0 &&
            Array.from(visibleCheckboxes).every(cb => cb.checked);
        selectAllCheckbox.checked = allChecked;
        selectAllCheckbox.indeterminate = this.selectedSongs.size > 0 && !allChecked;
    }

    batchFavorite() {
        this.selectedSongs.forEach(songId => {
            this.app.playlistManager.favorites.add(songId);
        });

        // 更新UI
        this.updatePlaylistDisplay();

        // 如果当前是收藏歌曲筛选，更新列表
        if (this.currentFilter === 'favorites') {
            this.updatePlaylistDisplay();
        }

        // 更新收藏按钮图标
        document.querySelectorAll('.favorite-action').forEach(btn => {
            const songId = parseInt(btn.dataset.songId);
            if (this.selectedSongs.has(songId)) {
                this.updateFavoriteIcon(btn, true);
            }
        });

        // 清除选择
        this.clearSelection();
    }

    batchUnfavorite() {
        this.selectedSongs.forEach(songId => {
            this.app.playlistManager.favorites.delete(songId);
        });

        // 更新UI
        this.updatePlaylistDisplay();

        // 如果当前是收藏歌曲筛选，更新列表
        if (this.currentFilter === 'favorites') {
            this.updatePlaylistDisplay();
        }

        // 更新收藏按钮图标
        document.querySelectorAll('.favorite-action').forEach(btn => {
            const songId = parseInt(btn.dataset.songId);
            if (this.selectedSongs.has(songId)) {
                this.updateFavoriteIcon(btn, false);
            }
        });

        // 清除选择
        this.clearSelection();
    }

    clearSelection() {
        this.selectedSongs.clear();
        document.querySelectorAll('.select-song').forEach(cb => {
            cb.checked = false;
        });
        document.querySelectorAll('.song-row').forEach(row => {
            row.classList.remove('selected');
        });
        this.updateBatchToolbar();
    }

    setupScrollDetection() {
        const lyricsContainer = document.querySelector('.lyrics-container');
        if (!lyricsContainer) return;

        // 清除之前的定时器
        if (this.autoScrollTimer) {
            clearTimeout(this.autoScrollTimer);
        }

        lyricsContainer.addEventListener('scroll', () => {
            // 检查是否真的是用户手动滚动（排除程序滚动的干扰）
            if (Math.abs(lyricsContainer.scrollTop - this.lastProgrammaticScroll) > 10) {
                this.userManuallyScrolled = true;
                this.lastManualScrollTime = Date.now();

                // 清除之前的定时器
                if (this.autoScrollTimer) {
                    clearTimeout(this.autoScrollTimer);
                }

                // 5秒后恢复自动滚动
                this.autoScrollTimer = setTimeout(() => {
                    if (Date.now() - this.lastManualScrollTime >= 5000) {
                        this.userManuallyScrolled = false;
                        this.lastManualScrollTime = 0;
                    }
                }, 5000);
            }
        });
    }


    updateNowPlaying(song) {
        if (!song) {
            // 重置显示
            document.getElementById('album-cover').src = 'assets/covers/default.jpg';
            document.getElementById('current-song-title').textContent = '暂无播放';
            document.getElementById('current-song-artist').textContent = '选择歌曲开始播放';

            document.getElementById('mini-cover').src = 'assets/covers/default.jpg';
            document.getElementById('mini-song-title').textContent = '无歌曲';
            document.getElementById('mini-song-artist').textContent = '--';

            // 移除播放状态
            document.querySelectorAll('.song-row.playing').forEach(row => {
                row.classList.remove('playing');
            });

            // 停止唱片旋转
            document.querySelector('.album-cover-wrapper').classList.remove('playing');
            return;
        }

        // 更新封面和歌曲信息
        const coverImg = document.getElementById('album-cover');
        const miniCoverImg = document.getElementById('mini-cover');

        coverImg.src = song.cover || 'assets/covers/default.jpg';
        coverImg.onerror = () => {
            coverImg.src = 'assets/covers/default.jpg';
        };

        miniCoverImg.src = song.cover || 'assets/covers/default.jpg';
        miniCoverImg.onerror = () => {
            miniCoverImg.src = 'assets/covers/default.jpg';
        };

        document.getElementById('current-song-title').textContent = song.title;
        document.getElementById('current-song-artist').textContent = song.artist;

        document.getElementById('mini-song-title').textContent = song.title;
        document.getElementById('mini-song-artist').textContent = song.artist;

        // 更新播放列表中的当前播放标记
        document.querySelectorAll('.song-row').forEach(row => {
            const songId = parseInt(row.dataset.songId);
            if (songId === song.id) {
                row.classList.add('playing');
            } else {
                row.classList.remove('playing');
            }
        });

        // 更新收藏按钮
        const isFavorite = this.app.playlistManager.favorites.has(song.id);
        this.updateFavoriteButton(isFavorite);

        // 开始唱片旋转
        if (this.app.audioController.isPlaying) {
            document.querySelector('.album-cover-wrapper').classList.add('playing');
        }


        const lyricsContainer = document.querySelector('.lyrics-container');
        if (lyricsContainer) {
            lyricsContainer.scrollTop = 0;
        }
    }

    updateFavoriteButton(isFavorite) {
        const favoriteBtn = document.getElementById('favorite-btn');
        const icon = favoriteBtn.querySelector('i');

        if (isFavorite) {
            icon.className = 'fas fa-heart';
            icon.style.color = '#ff4757';
            favoriteBtn.title = '取消收藏';
        } else {
            icon.className = 'far fa-heart';
            icon.style.color = '';
            favoriteBtn.title = '收藏';
        }
    }

    updateFavoriteIcon(button, isFavorite) {
        const icon = button.querySelector('i');
        if (isFavorite) {
            icon.className = 'fas fa-heart';
            icon.style.color = '#ff4757';
            button.title = '取消收藏';
        } else {
            icon.className = 'far fa-heart';
            icon.style.color = '';
            button.title = '收藏';
        }
    }

    updateSongDuration(songId, duration) {
        const row = document.querySelector(`.song-row[data-song-id="${songId}"]`);
        if (row) {
            const durationCell = row.querySelector('td:nth-child(5)');
            if (durationCell) {
                durationCell.textContent = duration;
            }
        }
    }

// 替换原来的 displayLyrics 方法
    displayLyrics(lyrics) {
        this.currentLyrics = lyrics;
        const lyricsDisplay = document.getElementById('lyrics-display');

        // 重置歌词滚动状态
        const lyricsContainer = document.querySelector('.lyrics-container');
        if (lyricsContainer) {
            lyricsContainer.scrollTop = 0;
            this.userManuallyScrolled = false;
            this.lastManualScrollTime = 0;
        }

        lyricsDisplay.innerHTML = '';
        lyrics.forEach((line, index) => {
            const p = document.createElement('p');
            p.textContent = line.text;
            p.dataset.index = index;
            p.dataset.time = line.time;
            lyricsDisplay.appendChild(p);
        });

        // 确保显示第一行
        this.highlightLyric(0);
    }


    scrollToLyricTop(index) {
        if (!this.autoScrollEnabled || this.userManuallyScrolled) return;

        const lyricsContainer = document.querySelector('.lyrics-container');
        const lyricsDisplay = document.getElementById('lyrics-display');
        const activeLine = lyricsDisplay.children[index];

        if (!activeLine || !lyricsContainer) return;

        // 只需减去容器的padding，让高亮行对齐顶部
        const containerStyle = getComputedStyle(lyricsContainer);
        const containerPaddingTop = parseInt(containerStyle.paddingTop);

        // 滚动到活动行的顶部，对齐容器顶部
        const targetScroll = activeLine.offsetTop - containerPaddingTop;

        // 限制滚动范围
        const maxScroll = Math.max(0, lyricsDisplay.scrollHeight - lyricsContainer.offsetHeight);
        const clampedScroll = Math.max(0, Math.min(targetScroll, maxScroll));

        this.lastProgrammaticScroll = clampedScroll;
        lyricsContainer.scrollTop = clampedScroll;
    }

    highlightLyric(index) {
        const lyricsDisplay = document.getElementById('lyrics-display');
        if (!lyricsDisplay) return;

        const lines = lyricsDisplay.querySelectorAll('p');
        lines.forEach(line => line.classList.remove('active'));

        if (lines[index]) {
            lines[index].classList.add('active');

            // 只有在自动滚动开启且没有手动滚动时才自动滚动
            if (this.autoScrollEnabled && !this.userManuallyScrolled) {
                this.scrollToLyricTop(index);
            }
        }
    }


    toggleAutoScroll(button) {
        this.autoScrollEnabled = !this.autoScrollEnabled;
        button.classList.toggle('active', this.autoScrollEnabled);

        const icon = button.querySelector('i');
        if (this.autoScrollEnabled) {
            icon.className = 'fas fa-sync';
            button.title = '自动滚动已开启';
            this.userManuallyScrolled = false;
            this.lastManualScrollTime = 0;

            // 立即同步到当前歌词位置
            const activeLine = document.querySelector('.lyrics-display p.active');
            if (activeLine) {
                const index = parseInt(activeLine.dataset.index);
                this.scrollToLyricTop(index);
            }
        } else {
            icon.className = 'fas fa-sync fa-spin';
            button.title = '自动滚动已关闭';
        }
    }


    toggleTheme() {
        document.body.classList.toggle('light-theme');
        const themeIcon = document.querySelector('#theme-toggle i');

        if (document.body.classList.contains('light-theme')) {
            themeIcon.className = 'fas fa-sun';
            themeIcon.title = '切换到深色模式';
        } else {
            themeIcon.className = 'fas fa-moon';
            themeIcon.title = '切换到浅色模式';
        }

        // 保存主题设置到本地存储
        localStorage.setItem('musicPlayerTheme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
    }

    updateTheme() {
        // 从本地存储加载主题设置
        const savedTheme = localStorage.getItem('musicPlayerTheme');

        if (savedTheme === 'light' ||
            (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches && !savedTheme)) {
            document.body.classList.add('light-theme');
            const themeIcon = document.querySelector('#theme-toggle i');
            themeIcon.className = 'fas fa-sun';
            themeIcon.title = '切换到深色模式';
        }
    }

    toggleBackgroundBlur() {
        const blurElement = document.querySelector('.background-blur');
        blurElement.classList.toggle('active');

        const blurIcon = document.querySelector('#blur-toggle i');
        if (blurElement.classList.contains('active')) {
            blurIcon.className = 'fas fa-mountain';
            blurIcon.title = '关闭背景模糊';
        } else {
            blurIcon.className = 'fas fa-snowflake';
            blurIcon.title = '开启背景模糊';
        }
    }

    toggleVisualizer() {
        const canvas = document.getElementById('visualizer-canvas');
        const visualizerToggle = document.getElementById('visualizer-toggle');

        if (canvas.style.display === 'none') {
            canvas.style.display = 'block';
            visualizerToggle.title = '隐藏可视化';
        } else {
            canvas.style.display = 'none';
            visualizerToggle.title = '显示可视化';
        }
    }

    toggleLyrics() {
        this.isLyricsVisible = !this.isLyricsVisible;
        const lyricsContainer = document.querySelector('.lyrics-container');
        const toggleBtn = document.getElementById('toggle-lyrics');

        if (this.isLyricsVisible) {
            lyricsContainer.style.display = 'block';
            toggleBtn.textContent = '隐藏歌词';
        } else {
            lyricsContainer.style.display = 'none';
            toggleBtn.textContent = '显示歌词';
        }
    }

    openModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    async handleFileUpload() {
        const audioFile = document.getElementById('audio-file').files[0];
        const title = document.getElementById('song-title').value.trim();
        const artist = document.getElementById('song-artist').value.trim();
        const coverFile = document.getElementById('cover-file').files[0];

        if (!audioFile) {
            alert('请选择音频文件');
            return;
        }

        // 创建对象URL
        const audioUrl = URL.createObjectURL(audioFile);
        let coverUrl = 'assets/covers/default.jpg';

        if (coverFile) {
            coverUrl = URL.createObjectURL(coverFile);
        }

        const song = {
            title: title || audioFile.name.replace(/\.[^/.]+$/, ""),
            artist: artist || '未知艺术家',
            src: audioUrl,
            cover: coverUrl,
            duration: '0:00'
        };

        const addedSong = this.app.playlistManager.addSong(song);

        // 关闭模态框
        this.closeAllModals();

        // 重置表单
        document.querySelector('.upload-form').reset();

        // 如果当前显示所有歌曲，更新列表
        if (this.currentFilter === 'all') {
            this.updatePlaylistDisplay();
        }

        alert('歌曲添加成功！');

        // 如果是第一首歌，自动播放
        if (this.app.playlistManager.playlist.length === 1) {
            this.app.playSong(addedSong);
        }
    }

    setupTouchEvents() {
        let touchStartX = 0;
        let touchStartY = 0;
        const playerSection = document.querySelector('.player-section');

        playerSection.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });

        playerSection.addEventListener('touchend', (e) => {
            if (!touchStartX) return;

            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;

            const diffX = touchStartX - touchEndX;
            const diffY = touchStartY - touchEndY;

            // 水平滑动大于垂直滑动，且滑动距离大于50px
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    // 向左滑动，下一首
                    this.app.playNext();
                } else {
                    // 向右滑动，上一首
                    this.app.playPrevious();
                }
            }

            touchStartX = 0;
            touchStartY = 0;
        });
    }

    // 更新最近播放列表显示
    updateRecentlyPlayedDisplay() {
        console.log('更新最近播放显示，当前筛选器:', this.currentFilter);
        console.log('最近播放列表:', this.app.playlistManager.recentlyPlayed);

        // 这个方法现在通过updatePlaylistDisplay来统一处理

        if (this.currentFilter === 'recent') {
            this.updatePlaylistDisplay();
        }
    }
}

export {UIManager};