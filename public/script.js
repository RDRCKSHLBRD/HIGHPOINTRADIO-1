class MP3Player {
    constructor() {
        // Initialize DOM element references
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
        this.libraryContainer = document.querySelector(".container1");

        // Initialize audio-related properties
        this.audioContext = null;
        this.audioElement = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.isRepeating = false;
        this.isTransitioning = false;
        this.currentTrackIndex = 0;
        this.playlist = [];
        this.playPromise = null;

        // Add throttling for time updates
        this.lastUpdateTime = 0;
        this.updateInterval = 250; // Update every 250ms

        // Set up loading indicator
        this.loadingIndicator = document.createElement("div");
        this.loadingIndicator.textContent = "Loading library...";
        this.loadingIndicator.style.color = "#333";
        this.libraryContainer.appendChild(this.loadingIndicator);

        // Initialize event listeners and load library
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
            const response = await fetch("library.json");
            if (!response.ok) throw new Error("Failed to load library.json");

            const files = await response.json();
            this.playlist = files.map((url) => {
                const name = url.split("/").pop().split(".")[0];
                return { name: decodeURIComponent(name), url };
            });

            console.log("Playlist loaded:", this.playlist);
        } catch (error) {
            console.error("Error loading library:", error);
            this.loadingIndicator.textContent = "Error loading library. Please try again.";
        }
    }

    initializeAudio() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    async loadTrack(index) {
        if (index >= 0 && index < this.playlist.length) {
            const track = this.playlist[index];
            if (track.url) {
                // Reset displays
                this.totalTimeElement.textContent = "00:00";
                this.elapsedTimeElement.textContent = "00:00";
                this.seekBar.value = 0;

                try {
                    // Fetch metadata first
                    const metadataResponse = await fetch(`/metadata?url=${encodeURIComponent(track.url)}`);
                    const metadata = await metadataResponse.json();

                    if (metadata.duration) {
                        const duration = Math.floor(metadata.duration);
                        this.totalTimeElement.textContent = this.formatTime(duration);
                        this.seekBar.max = duration;
                    }
                } catch (error) {
                    console.error("Error fetching metadata:", error);
                }

                // Initialize audio context if needed
                this.initializeAudio();

                const proxyUrl = `/proxy?url=${encodeURIComponent(track.url)}`;

                // Clean up old audio element and promise
                if (this.audioElement) {
                    if (this.playPromise) {
                        await this.playPromise;
                    }
                    this.audioElement.pause();
                    this.audioElement.src = "";
                }

                // Create new audio element
                this.audioElement = new Audio(proxyUrl);

                this.audioElement.addEventListener("loadedmetadata", () => {
                    if (this.audioElement.duration) {
                        this.totalTimeElement.textContent = this.formatTime(this.audioElement.duration);
                        this.seekBar.max = Math.floor(this.audioElement.duration);
                    }
                });

                this.audioElement.addEventListener("timeupdate", () => {
                    const now = Date.now();
                    if (now - this.lastUpdateTime >= this.updateInterval) {
                        this.lastUpdateTime = now;
                        if (!isNaN(this.audioElement.currentTime)) {
                            this.elapsedTimeElement.textContent = this.formatTime(this.audioElement.currentTime);
                            this.seekBar.value = Math.floor(this.audioElement.currentTime);
                        }
                    }
                });

                this.audioElement.addEventListener("progress", () => {
                    const buffered = this.audioElement.buffered;
                    if (buffered.length > 0) {
                        const loaded = buffered.end(buffered.length - 1) / this.audioElement.duration;
                        this.seekBar.style.setProperty("--buffered", `${Math.floor(loaded * 100)}%`);
                    }
                });

                this.audioElement.addEventListener("ended", () => {
                    if (this.isRepeating) {
                        this.playTrack();
                    } else {
                        this.nextTrack();
                    }
                });

                // Set initial volume
                if (this.volumeControl.value) {
                    this.audioElement.volume = this.volumeControl.value;
                }

                this.audioElement.load();
                this.fileLabel.textContent = `File: ${track.name}`;
                this.currentTrackIndex = index;
                console.log("Track loaded:", track.name);
            }
        }
    }

    async playTrack() {
        if (this.isTransitioning) return;
        this.isTransitioning = true;

        try {
            if (!this.audioContext) this.initializeAudio();

            if (this.audioContext.state === "suspended") {
                await this.audioContext.resume();
            }

            if (!this.audioElement) {
                await this.loadTrack(this.currentTrackIndex);
            }

            // Wait for any pending play operation to complete
            if (this.playPromise) {
                await this.playPromise;
            }

            // Start new play operation
            this.playPromise = this.audioElement.play();
            await this.playPromise;

            this.isPlaying = true;
            this.isPaused = false;
            console.log("Playing track");
        } catch (error) {
            console.error("Error playing track:", error);
            // Reset state on error
            this.isPlaying = false;
            this.isPaused = true;
        } finally {
            this.isTransitioning = false;
            this.playPromise = null;
        }
    }

    async pauseTrack() {
        if (this.isTransitioning) return;

        try {
            // Wait for any pending play operation to complete
            if (this.playPromise) {
                await this.playPromise;
            }

            if (this.audioElement && this.isPlaying) {
                this.audioElement.pause();
                this.isPlaying = false;
                this.isPaused = true;
                console.log("Paused track");
            } else if (this.audioElement && this.isPaused) {
                await this.playTrack();
            }
        } catch (error) {
            console.error("Error during pause:", error);
        }
    }

    async stopTrack() {
        try {
            // Wait for any pending play operation to complete
            if (this.playPromise) {
                await this.playPromise;
            }

            if (this.audioElement) {
                this.audioElement.pause();
                this.audioElement.currentTime = 0;
                this.isPlaying = false;
                this.isPaused = false;
            }
            console.log("Stopping track");
        } catch (error) {
            console.error("Error during stop:", error);
        }
    }

    skip(seconds) {
        if (this.audioElement) {
            this.audioElement.currentTime = Math.max(0, Math.min(this.audioElement.currentTime + seconds, this.audioElement.duration || 0));
            console.log(`Skipped ${seconds} seconds`);
        }
    }

    toggleRepeat() {
        this.isRepeating = !this.isRepeating;
        if (this.audioElement) {
            this.audioElement.loop = this.isRepeating;
        }
        console.log(`Repeat ${this.isRepeating ? "enabled" : "disabled"}`);
    }

    async nextTrack() {
        this.currentTrackIndex = (this.currentTrackIndex + 1) % this.playlist.length;
        await this.loadTrack(this.currentTrackIndex);
        if (this.isPlaying) await this.playTrack();
        console.log("Next track");
    }

    async previousTrack() {
        this.currentTrackIndex = (this.currentTrackIndex - 1 + this.playlist.length) % this.playlist.length;
        await this.loadTrack(this.currentTrackIndex);
        if (this.isPlaying) await this.playTrack();
        console.log("Previous track");
    }

    changeVolume(value) {
        if (this.audioElement) {
            this.audioElement.volume = value;
            this.volAmtElement.textContent = `${Math.round(value * 100)}%`;
        }
        console.log("Volume changed:", value);
    }

    seek(value) {
        if (this.audioElement) {
            this.audioElement.currentTime = Math.min(value, this.audioElement.duration || 0);
        }
        console.log("Seek to:", value);
    }

    async ejectTrack() {
        await this.stopTrack();
        this.fileLabel.textContent = "Click to select a file";
        this.elapsedTimeElement.textContent = "00:00";
        this.totalTimeElement.textContent = "00:00";
        this.volAmtElement.textContent = "";
        this.seekBar.value = 0;
        console.log("Track ejected");
    }

    openFileDialog() {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "audio/*";
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                this.loadFile(file);
            }
        };
        fileInput.click();
    }

    async loadFile(file) {
        if (this.playPromise) {
            await this.playPromise;
        }
        const fileURL = URL.createObjectURL(file);
        this.initializeAudio();
        this.audioElement = new Audio(fileURL);
        this.audioElement.load();
        this.fileLabel.textContent = `File: ${file.name}`;
        console.log("File loaded:", file.name);
    }

    updateLibraryDisplay() {
        this.libraryContainer.innerHTML = '<h2>LIBRARY</h2><ul id="libraryList"></ul>';
        const libraryList = this.libraryContainer.querySelector("#libraryList");

        if (this.playlist.length === 0) {
            const li = document.createElement("li");
            li.textContent = "No tracks found in the library.";
            li.style.color = "#333";
            libraryList.appendChild(li);
        } else {
            this.playlist.forEach((track, index) => {
                const li = document.createElement("li");
                li.textContent = track.name;
                li.style.cursor = "pointer";
                li.addEventListener("click", async () => {
                    await this.loadTrack(index);
                    await this.playTrack();
                });
                libraryList.appendChild(li);
            });
        }

        console.log("Library display updated");
    }

    formatTime(seconds) {
        try {
            if (!seconds || isNaN(seconds)) {
                return "00:00";
            }
            seconds = Math.max(0, Number(seconds));
            const minutes = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        } catch (error) {
            console.error("Error formatting time:", error);
            return "00:00";
        }
    }
}

// Initialize the player when the DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
    const player = new MP3Player();
    console.log("MP3 Player initialized");
});
