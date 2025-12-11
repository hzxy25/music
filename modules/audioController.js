class AudioController {
    constructor() {
        this.audio = document.getElementById('audio-player');
        this.currentSong = null;
        this.isPlaying = false;
        this.isSeeking = false;
        this.volume = 0.7;
        this.playbackMode = 'order'; // 'order', 'shuffle', 'repeat-one'
        this.playHistory = [];

        // Web Audio API 上下文
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.eqFilters = {};

        this.initAudioContext();
    }

    init(app) {
        this.app = app;
        this.bindEvents();
    }

    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.setupAudioNodes();
        } catch (e) {
            console.warn('Web Audio API 不支持，将使用标准音频播放');
        }
    }

    setupAudioNodes() {
        if (!this.audioContext) return;

        this.source = this.audioContext.createMediaElementSource(this.audio);
        this.analyser = this.audioContext.createAnalyser();

        // 创建均衡器滤波器
        this.eqFilters.low = this.audioContext.createBiquadFilter();
        this.eqFilters.mid = this.audioContext.createBiquadFilter();
        this.eqFilters.high = this.audioContext.createBiquadFilter();

        this.eqFilters.low.type = 'lowshelf';
        this.eqFilters.mid.type = 'peaking';
        this.eqFilters.high.type = 'highshelf';

        this.eqFilters.low.frequency.value = 320;
        this.eqFilters.mid.frequency.value = 1000;
        this.eqFilters.high.frequency.value = 3200;

        // 连接音频节点
        this.source.connect(this.eqFilters.low);
        this.eqFilters.low.connect(this.eqFilters.mid);
        this.eqFilters.mid.connect(this.eqFilters.high);
        this.eqFilters.high.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);

        // 配置分析器
        this.analyser.fftSize = 256;
    }

    bindEvents() {
        // 音频事件
        this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
        this.audio.addEventListener('ended', () => this.onSongEnded());
        this.audio.addEventListener('loadedmetadata', () => this.onLoadedMetadata());

        // 播放器控制事件
        document.getElementById('play-pause-btn').addEventListener('click', () => this.togglePlay());
        document.getElementById('next-btn').addEventListener('click', () => this.app.playNext());
        document.getElementById('prev-btn').addEventListener('click', () => this.app.playPrevious());

        // 替换原有的鼠标拖动处理代码
        const progressSlider = document.getElementById('progress-slider');
        const progressBar = document.querySelector('.progress-bar');

        // 鼠标拖动处理
        progressSlider.addEventListener('mousedown', () => {
            this.isSeeking = true;
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isSeeking) {  // 使用this.isSeeking而非局部变量
                const rect = progressBar.getBoundingClientRect();
                const percent = Math.max(0, Math.min(100,
                    ((e.clientX - rect.left) / rect.width) * 100
                ));
                progressSlider.value = percent;
                // 拖动时不实际跳转，只更新滑块位置
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isSeeking) {  // 使用this.isSeeking而非局部变量
                // 鼠标释放时才实际跳转
                const percent = parseFloat(progressSlider.value);
                this.seek(percent);
                this.isSeeking = false;
            }
        });

        progressBar.addEventListener('click', (e) => {
            // 移除原有的e.target判断，允许点击滑块时也能跳转
            const rect = progressBar.getBoundingClientRect();
            const percent = Math.max(0, Math.min(100,
                ((e.clientX - rect.left) / rect.width) * 100
            ));
            progressSlider.value = percent;
            this.seek(percent);
        });

        // 触摸事件处理也做类似修改
        progressSlider.addEventListener('touchstart', () => {
            this.isSeeking = true;
        });

        progressSlider.addEventListener('touchmove', (e) => {
            if (this.isSeeking) {
                const rect = progressBar.getBoundingClientRect();
                const touch = e.touches[0];
                const percent = Math.max(0, Math.min(100,
                    ((touch.clientX - rect.left) / rect.width) * 100
                ));
                progressSlider.value = percent;
                // 拖动时不实际跳转
            }
        });

        progressSlider.addEventListener('touchend', () => {
            if (this.isSeeking) {
                // 触摸结束时才实际跳转
                const percent = parseFloat(progressSlider.value);
                this.seek(percent);
                this.isSeeking = false;
            }
        });
        // 音量控制
        const volumeSlider = document.getElementById('volume-slider');
        volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value / 100));

        // 播放模式
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setPlaybackMode(e.target.dataset.mode);
            });
        });
    }

    playSong(song) {
        if (!song || !song.src) return;

        this.currentSong = song;
        this.audio.src = song.src;

        // 添加到最近播放
        if (this.app && this.app.playlistManager) {
            this.app.playlistManager.addToRecentlyPlayed(song);
        }

        // 重置歌词容器滚动位置
        const lyricsContainer = document.querySelector('.lyrics-container');
        if (lyricsContainer) {
            lyricsContainer.scrollTop = 0;
            // 确保UI管理器知道这重置了手动滚动状态
            if (this.app.uiManager) {
                this.app.uiManager.userManuallyScrolled = false;
                this.app.uiManager.lastManualScrollTime = 0;
            }
        }

        // 尝试加载歌词
        if (song.lyrics) {
            this.loadLyrics(song.lyrics);
        }

        this.play();
    }


    async play() {
        try {
            // 恢复 AudioContext 如果被暂停
            if (this.audioContext && this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            await this.audio.play();
            this.isPlaying = true;
            this.updatePlayButton();

            // 添加到播放历史
            if (this.currentSong) {
                this.playHistory.push({
                    song: this.currentSong,
                    timestamp: new Date()
                });
            }
        } catch (error) {
            console.error('播放失败:', error);
        }

    }

    pause() {
        this.audio.pause();
        this.isPlaying = false;
        this.updatePlayButton();
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            if (this.audio.src) {
                this.play();
            } else {
                // 如果没有当前歌曲，播放第一首
                const firstSong = this.app.playlistManager.getPlaylist()[0];
                if (firstSong) {
                    this.app.playSong(firstSong);
                }
            }
        }
    }

    seek(percent) {
        if (this.audio.duration) {
            this.audio.currentTime = (percent / 100) * this.audio.duration;
        }
    }

    setVolume(value) {
        this.volume = Math.max(0, Math.min(1, value));
        this.audio.volume = this.volume;
        this.updateVolumeUI();

        // 保存到本地存储
        if (this.app && this.app.playlistManager) {
            this.app.playlistManager.saveToLocalStorage();
        }
    }

    increaseVolume() {
        this.setVolume(this.volume + 0.1);
    }

    decreaseVolume() {
        this.setVolume(this.volume - 0.1);
    }

    toggleMute() {
        if (this.audio.muted) {
            this.audio.muted = false;
        } else {
            this.audio.muted = true;
        }
        this.updateVolumeUI();
    }

    setPlaybackMode(mode) {
        this.playbackMode = mode;

        // 更新UI
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }

    updateEQ(band, value) {
        if (!this.eqFilters[band]) return;

        // 将值从 -40 到 40 转换为分贝
        const gain = parseFloat(value);
        this.eqFilters[band].gain.value = gain;
    }

    getAudioData() {
        if (!this.analyser) return null;

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);

        return dataArray;
    }

    loadLyrics(lyricsPath) {
        fetch(lyricsPath)
            .then(response => response.text())
            .then(text => {
                const parsedLyrics = this.parseLRC(text);
                this.app.uiManager.displayLyrics(parsedLyrics);
            })
            .catch(error => {
                console.error('加载歌词失败:', error);
                this.app.uiManager.displayLyrics([]);
            });
    }

    parseLRC(lrcText) {
        const lines = lrcText.split('\n');
        const lyrics = [];

        lines.forEach(line => {
            const timeMatch = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]/);
            if (timeMatch) {
                const minutes = parseInt(timeMatch[1]);
                const seconds = parseInt(timeMatch[2]);
                const milliseconds = parseInt(timeMatch[3]);
                const time = minutes * 60 + seconds + milliseconds / 1000;

                const text = line.replace(/\[.*?\]/g, '').trim();
                if (text) {
                    lyrics.push({time, text});
                }
            }
        });

        return lyrics.sort((a, b) => a.time - b.time);
    }

    // 事件处理
    onTimeUpdate() {
        // 如果用户正在拖动进度条，暂停自动更新
        if (this.isSeeking) return;

        const currentTime = this.audio.currentTime;
        const duration = this.audio.duration || 0;
        const progress = duration ? (currentTime / duration) * 100 : 0;

        // 更新进度条
        document.getElementById('progress-slider').value = progress;
        document.querySelector('.progress-fill').style.width = `${progress}%`;

        // 更新时间显示
        document.getElementById('current-time').textContent = this.formatTime(currentTime);
        document.getElementById('total-time').textContent = this.formatTime(duration);

        // 更新歌词
        this.updateLyrics(currentTime);

        // 更新可视化
        this.updateVisualization();
    }

    onSongEnded() {
        if (this.playbackMode === 'repeat-one') {
            this.audio.currentTime = 0;
            this.play();
        } else {
            this.app.playNext();
        }
    }

    onLoadedMetadata() {
        if (this.currentSong && !this.currentSong.duration) {
            this.currentSong.duration = this.formatTime(this.audio.duration);
            this.app.uiManager.updateSongDuration(this.currentSong.id, this.currentSong.duration);
        }
    }

    // UI更新方法
    updatePlayButton() {
        const playBtn = document.getElementById('play-pause-btn');
        const icon = playBtn.querySelector('i');

        if (this.isPlaying) {
            icon.className = 'fas fa-pause';
            playBtn.title = '暂停';
            document.querySelector('.album-cover-wrapper').classList.add('playing');
        } else {
            icon.className = 'fas fa-play';
            playBtn.title = '播放';
            document.querySelector('.album-cover-wrapper').classList.remove('playing');
        }
    }

    updateVolumeUI() {
        const volumeBtn = document.getElementById('volume-btn');
        const icon = volumeBtn.querySelector('i');
        const volumeSlider = document.getElementById('volume-slider');

        volumeSlider.value = this.volume * 100;

        if (this.audio.muted || this.volume === 0) {
            icon.className = 'fas fa-volume-mute';
        } else if (this.volume < 0.5) {
            icon.className = 'fas fa-volume-down';
        } else {
            icon.className = 'fas fa-volume-up';
        }
    }

    updateLyrics(currentTime) {
        const lyrics = this.app.uiManager.currentLyrics;
        if (!lyrics || lyrics.length === 0) return;

        // 找到当前应显示的歌词
        let activeIndex = -1;
        for (let i = 0; i < lyrics.length; i++) {
            if (lyrics[i].time <= currentTime) {
                activeIndex = i;
            } else {
                break;
            }
        }

        if (activeIndex !== -1) {
            this.app.uiManager.highlightLyric(activeIndex);
        }
    }

    updateVisualization() {
        const canvas = document.getElementById('visualizer-canvas');
        const ctx = canvas.getContext('2d');

        if (!canvas.width || !canvas.height) {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        }

        const data = this.getAudioData();
        if (!data) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / data.length) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < data.length; i++) {
            barHeight = data[i] / 2;

            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, '#1db954');
            gradient.addColorStop(1, '#14833b');

            ctx.fillStyle = gradient;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

            x += barWidth + 1;
        }
    }

    // 工具方法
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

export {AudioController};