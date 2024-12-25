//script.js

class MP3Player {
    constructor() {
        this.playButton = document.getElementById("playButton");
        this.stopButton = document.getElementById("stopButton");
        this.pauseButton = document.getElementById("pauseButton");
        this.prevButton = document.getElementById("prevButton");
        this.nextButton = document.getElementById("nextButton");
        this.BKshuffleButton = document.getElementById("BKshuffleButton");
        this.FWDshuffleButton = document.getElementById("FWDshuffleButton");
        this.repeatButton = document.getElementById("repeatButton");
        this.ejectButton = document.getElementById("ejectButton");
        this.seekBar = document.getElementById("seekBar");
        this.volumeControl = document.getElementById("volumeControl");
        this.fileLabel = document.getElementById("fileLabel");
        this.fileUploadWrapper = document.querySelector(".file-upload-wrapper");
        this.elapsedTimeElement = document.querySelector(".elapsed-time");
        this.totalTimeElement = document.querySelector(".total-time");
        this.volAmtElement = document.querySelector(".VolAmt");
        this.libraryContainer = document.querySelector('.container1');

        this.audioContext = null;
        this.audioElement = null;
        this.sourceNode = null;
        this.gainNode = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.isRepeating = false;
        this.currentTrackIndex = 0;

        this.libraryPath = 'https://storage.googleapis.com/ip-cassette/cassette1/library/';

        this.playlist = [];

        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.textContent = 'Loading library...';
        this.loadingIndicator.style.color = '#333';
        this.libraryContainer.appendChild(this.loadingIndicator);

        this.initEventListeners();
        this.loadLibraryFiles().then(() => {
            this.libraryContainer.removeChild(this.loadingIndicator);
            this.updateLibraryDisplay();
        });
    }

    initEventListeners() {
        this.playButton.addEventListener("click", () => this.playTrack());
        this.stopButton.addEventListener("click", () => this.stopTrack());
        this.pauseButton.addEventListener("click", () => this.pauseTrack());
        this.prevButton.addEventListener("click", () => this.previousTrack());
        this.nextButton.addEventListener("click", () => this.nextTrack());
        this.BKshuffleButton.addEventListener("click", () => this.skip(-30));
        this.FWDshuffleButton.addEventListener("click", () => this.skip(30));
        this.repeatButton.addEventListener("click", () => this.toggleRepeat());
        this.ejectButton.addEventListener("click", () => this.ejectTrack());
        this.volumeControl.addEventListener("input", (e) => this.changeVolume(e.target.value));
        this.seekBar.addEventListener("input", (e) => this.seek(e.target.value));
        this.fileUploadWrapper.addEventListener("click", () => this.openFileDialog());
    }

    async loadLibraryFiles() {
        try {
            const response = await fetch('/api/library');
            const files = await response.json();
            this.playlist = files.map(file => ({ name: file, url: null }));
            
            for (let track of this.playlist) {
                try {
                    const response = await fetch(this.libraryPath + track.name);
                    const blob = await response.blob();
                    track.url = URL.createObjectURL(blob);
                    console.log(`Loaded ${track.name}`);
                } catch (error) {
                    console.error(`Error loading ${track.name}:`, error);
                }
            }
        } catch (error) {
            console.error('Error fetching library:', error);
            this.loadingIndicator.textContent = 'Error loading library. Please try again.';
        }
    }

    initializeAudio() {
        if (this.audioContext) return;

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioElement = new Audio();
        this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
        this.gainNode = this.audioContext.createGain();

        this.sourceNode.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);

        this.audioElement.addEventListener('loadedmetadata', () => {
            this.totalTimeElement.textContent = this.formatTime(this.audioElement.duration);
            this.seekBar.max = this.audioElement.duration;
        });

        this.audioElement.addEventListener('timeupdate', () => {
            this.elapsedTimeElement.textContent = this.formatTime(this.audioElement.currentTime);
            this.seekBar.value = this.audioElement.currentTime;
        });

        this.audioElement.addEventListener('ended', () => {
            if (!this.isRepeating) {
                this.nextTrack();
            }
        });

        console.log("Audio initialized");
    }

    loadTrack(index) {
        if (index >= 0 && index < this.playlist.length) {
            this.initializeAudio();
            const track = this.playlist[index];
            if (track.url) {
                this.audioElement.src = track.url;
                this.fileLabel.textContent = `File: ${track.name}`;
                this.currentTrackIndex = index;
                this.audioElement.load();
                console.log("Track loaded:", track.name);
            } else {
                console.log("Track not loaded:", track.name);
            }
        } else {
            console.log("Invalid track index:", index);
        }
    }

    playTrack() {
        if (!this.audioElement) {
            this.loadTrack(this.currentTrackIndex);
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        this.audioElement.play();
        this.isPlaying = true;
        this.isPaused = false;
        console.log("Playing track");
    }

    stopTrack() {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
            this.isPlaying = false;
            this.isPaused = false;
        }
        console.log("Stopping track");
    }

    pauseTrack() {
        if (this.audioElement) {
            if (this.isPlaying) {
                this.audioElement.pause();
                this.isPlaying = false;
                this.isPaused = true;
            } else if (this.isPaused) {
                this.audioElement.play();
                this.isPlaying = true;
                this.isPaused = false;
            }
        }
        console.log(this.isPaused ? "Paused track" : "Resumed track");
    }

    skip(seconds) {
        if (this.audioElement) {
            this.audioElement.currentTime += seconds;
            console.log(`Skipped ${seconds} seconds`);
        }
    }

    toggleRepeat() {
        this.isRepeating = !this.isRepeating;
        if (this.audioElement) {
            this.audioElement.loop = this.isRepeating;
        }
        console.log(`Repeat ${this.isRepeating ? 'enabled' : 'disabled'}`);
        // Update repeat button UI if needed
    }

    nextTrack() {
        this.currentTrackIndex = (this.currentTrackIndex + 1) % this.playlist.length;
        this.loadTrack(this.currentTrackIndex);
        if (this.isPlaying) this.playTrack();
        console.log("Next track");
    }

    previousTrack() {
        this.currentTrackIndex = (this.currentTrackIndex - 1 + this.playlist.length) % this.playlist.length;
        this.loadTrack(this.currentTrackIndex);
        if (this.isPlaying) this.playTrack();
        console.log("Previous track");
    }

    changeVolume(value) {
        if (this.gainNode) {
            this.gainNode.gain.value = value;
            this.volAmtElement.textContent = `${Math.round(value * 100)}`;
        }
        console.log("Volume changed:", value);
    }

    seek(value) {
        if (this.audioElement) {
            this.audioElement.currentTime = value;
        }
        console.log("Seek to:", value);
    }

    ejectTrack() {
        this.stopTrack();
        this.fileLabel.textContent = "Click to select a file";
        this.elapsedTimeElement.textContent = "00:00";
        this.totalTimeElement.textContent = "00:00";
        this.volAmtElement.textContent = "";
        this.seekBar.value = 0;
        console.log("Track ejected");
    }

    openFileDialog() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'audio/*';
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadFile(file);
            }
        };
        fileInput.click();
    }

    loadFile(file) {
        const fileURL = URL.createObjectURL(file);
        this.initializeAudio();
        this.audioElement.src = fileURL;
        this.fileLabel.textContent = `File: ${file.name}`;
        this.audioElement.load();
        console.log("File loaded:", file.name);
    }

    updateLibraryDisplay() {
        this.libraryContainer.innerHTML = '<h2>LIBRARY</h2><ul id="libraryList"></ul>';
        const libraryList = this.libraryContainer.querySelector('#libraryList');

        if (this.playlist.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No tracks found in the library.';
            li.style.color = '#333';
            libraryList.appendChild(li);
        } else {
            this.playlist.forEach((track, index) => {
                const li = document.createElement('li');
                li.textContent = track.name;
                li.addEventListener('click', () => {
                    this.loadTrack(index);
                    this.playTrack();
                });
                libraryList.appendChild(li);
            });
        }

        console.log("Library display updated");
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }
}

// Initialize the player when the DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
    const player = new MP3Player();
    console.log("MP3 Player initialized");
});