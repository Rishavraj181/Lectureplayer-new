// Global variable to hold the YouTube player instance
let player;
let progressUpdateInterval;
let currentVideoId = null;
let currentVideoTitle = "Video Player"; // Default title
let controlsTimeout; // For hiding controls

// --- DOM Elements ---
// Player elements
const playerWrapper = document.querySelector('.player-wrapper');
const playerContainer = document.getElementById('player-container');
const videoTitleElement = document.getElementById('video-title');
const playPauseBtn = document.getElementById('play-pause-btn');
const playPauseIcon = playPauseBtn?.querySelector('i'); // Use optional chaining ?
const overlayPlayButton = document.getElementById('overlay-play');
const seekBar = document.getElementById('seek-bar');
const progressBar = document.getElementById('progress-bar');
const timeDisplay = document.getElementById('time-display');
const volumeBtn = document.getElementById('volume-btn');
const volumeIcon = volumeBtn?.querySelector('i'); // Use optional chaining ?
const volumeSlider = document.getElementById('volume-slider');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const controlsContainer = document.getElementById('controls');
const errorMessageElement = document.getElementById('error-message');

// --- NEW Settings Menu Elements ---
const settingsBtn = document.getElementById('settings-btn');
const settingsMenu = document.getElementById('settings-menu');
const speedSubmenu = document.getElementById('speed-submenu');
const qualitySubmenu = document.getElementById('quality-submenu');
const currentSpeedDisplay = document.getElementById('current-speed-display');
const currentQualityDisplay = document.getElementById('current-quality-display');
const speedOptionsContainer = document.getElementById('speed-options-container'); // UL for speed li
const qualityOptionsContainer = document.getElementById('quality-options-container'); // UL for quality li
// --- END Settings Menu Elements ---

// Tab elements
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// --- Selectors for Dynamic Content Areas ---
const studyMaterialList = document.getElementById('study-material-list');
const relatedVideosList = document.getElementById('related-videos-list');
const timelineList = document.getElementById('timeline-list'); // Selector for the newly added div

// Rating elements (optional)
const ratingStars = document.querySelectorAll('#ratings-content .stars i'); // More specific selector
const ratingFeedback = document.getElementById('rating-feedback');


// --- Utility Functions ---

function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) {
        return '00:00';
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function showError(message) {
     if (errorMessageElement) {
        errorMessageElement.textContent = message;
        errorMessageElement.classList.remove('hidden');
     }
     if (controlsContainer) {
        controlsContainer.classList.add('hidden'); // Hide controls on error
        controlsContainer.style.opacity = '0'; // Ensure hidden visually
     }
     if (playerContainer) {
        // Replace player with error message
        playerContainer.innerHTML = `<div style="color: red; text-align: center; padding: 20px; font-weight: bold; background: #111; height: 100%; display: flex; align-items: center; justify-content: center;">${message}</div>`;
     }
     console.error("Player Error:", message);
     // Hide menus on error too
     if (settingsMenu) settingsMenu.classList.add('hidden');
     if (speedSubmenu) speedSubmenu.classList.add('hidden');
     if (qualitySubmenu) qualitySubmenu.classList.add('hidden');
     if (settingsBtn) settingsBtn.setAttribute('aria-expanded', 'false');
}

// --- Function to Fetch and Populate Data ---
async function loadDynamicContent(videoId) {
    // Ensure all list containers exist
    if (!studyMaterialList || !relatedVideosList || !timelineList) {
        console.error("Dynamic content list containers not found! Cannot load data.");
        return;
    }

    // Clear existing content and show loading messages
    studyMaterialList.innerHTML = '<p class="loading-message">Loading materials...</p>';
    relatedVideosList.innerHTML = '<p class="loading-message">Loading related videos...</p>';
    timelineList.innerHTML = '<p class="loading-message">Loading timeline...</p>';

    try {
        console.log("Fetching video_data.json...");
        const response = await fetch('video_data.json');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status} while fetching video_data.json`);
        }
        const allData = await response.json();
        console.log("Fetched data:", allData);

        const videoData = allData.videos ? allData.videos[videoId] : null;

        if (!videoData) {
             console.warn(`No data found in video_data.json for video ID: ${videoId}`);
             studyMaterialList.innerHTML = '<p class="info-message">No study materials available for this video.</p>';
             relatedVideosList.innerHTML = '<p class="info-message">No related videos available for this video.</p>';
             timelineList.innerHTML = '<p class="info-message">No timeline available for this video.</p>';
             return;
        }

        // --- Populate Study Materials ---
        studyMaterialList.innerHTML = '';
        if (videoData.studyMaterials?.length > 0) {
            videoData.studyMaterials.forEach(item => {
                const div = document.createElement('div'); div.className = 'material-item';
                const span = document.createElement('span'); span.textContent = item.title || 'Untitled Material';
                const link = document.createElement('a'); link.href = item.url || '#';
                if (item.external || (item.url && (item.url.toLowerCase().endsWith('.pdf') || item.url.startsWith('http')))) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
                const button = document.createElement('button'); button.className = 'view-button'; button.textContent = 'View';
                link.appendChild(button); div.appendChild(span); div.appendChild(link); studyMaterialList.appendChild(div);
            });
        } else { studyMaterialList.innerHTML = '<p class="info-message">No study materials available.</p>'; }

        // --- Populate Related Videos ---
        relatedVideosList.innerHTML = '';
        if (videoData.relatedVideos?.length > 0) {
            videoData.relatedVideos.forEach(item => {
                if (!item.youtubeId || !item.title) { console.warn("Skipping related video:", item); return; }
                const div = document.createElement('div'); div.className = 'material-item';
                const span = document.createElement('span'); span.textContent = item.title;
                const playerUrl = new URL(window.location.pathname, window.location.origin);
                playerUrl.searchParams.set('youtubeId', item.youtubeId);
                const urlTitle = item.baseTitle || item.title;
                playerUrl.searchParams.set('title', urlTitle.replace(/ /g, '_'));
                const link = document.createElement('a'); link.href = playerUrl.toString();
                const button = document.createElement('button'); button.className = 'view-button'; button.textContent = 'Watch';
                link.appendChild(button); div.appendChild(span); div.appendChild(link); relatedVideosList.appendChild(div);
            });
        } else { relatedVideosList.innerHTML = '<p class="info-message">No related videos available.</p>'; }

        // --- Populate Timeline / Chapters ---
        timelineList.innerHTML = '';
        if (videoData.timeline?.length > 0) {
            videoData.timeline.forEach(chapter => {
                 if (typeof chapter.time !== 'number' || !chapter.title) { console.warn("Skipping invalid timeline chapter:", chapter); return; }
                const div = document.createElement('div'); div.className = 'timeline-item'; div.dataset.time = chapter.time;
                div.textContent = `${formatTime(chapter.time)} - ${chapter.title}`; div.setAttribute('role', 'button'); div.tabIndex = 0;
                timelineList.appendChild(div);
            });
        } else { timelineList.innerHTML = '<p class="info-message">No timeline available.</p>'; }

    } catch (error) {
        console.error('Error loading or processing dynamic content:', error);
        if (studyMaterialList) studyMaterialList.innerHTML = `<p class="error">Error loading materials: ${error.message}</p>`;
        if (relatedVideosList) relatedVideosList.innerHTML = `<p class="error">Error loading related videos: ${error.message}</p>`;
        if (timelineList) timelineList.innerHTML = `<p class="error">Error loading timeline: ${error.message}</p>`;
    }
}


// --- Player Initialization ---
window.initializePlayer = function() {
    console.log("Initializing player...");
    currentVideoId = getUrlParameter('youtubeId');
    const titleParam = getUrlParameter('title');

    if (titleParam) {
        currentVideoTitle = titleParam.replace(/_/g, ' ');
        if (videoTitleElement) videoTitleElement.textContent = currentVideoTitle;
        document.title = currentVideoTitle;
    } else {
         if (videoTitleElement) videoTitleElement.textContent = "Video Player";
         document.title = "Video Player";
    }

    if (!currentVideoId) {
        showError("Error: No 'youtubeId' parameter found in the URL.");
        return;
    }

    loadDynamicContent(currentVideoId);

    if (errorMessageElement) errorMessageElement.classList.add('hidden');

    try {
        if (!document.getElementById('youtube-player')) {
             throw new Error("Player container div #youtube-player not found in HTML.");
        }

        player = new YT.Player('youtube-player', {
            height: '100%',
            width: '100%',
            videoId: currentVideoId,
            playerVars: {
                'playsinline': 1, 'autoplay': 0, 'controls': 0, 'rel': 0,
                'showinfo': 0, 'modestbranding': 1, 'iv_load_policy': 3, 'disablekb': 1
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError
            }
        });
    } catch (error) {
         showError(`Failed to create YouTube player instance: ${error.message}`);
         console.error(error);
    }
};

// --- YouTube Player Event Handlers ---
function onPlayerReady(event) {
    console.log("Player Ready:", currentVideoId);

    if (overlayPlayButton) overlayPlayButton.classList.remove('hidden');
    if (controlsContainer) controlsContainer.classList.remove('hidden');

    // Check if essential elements exist before setting up listeners
    const essentialElements = [
        playPauseBtn, seekBar, timeDisplay, volumeBtn, volumeSlider,
        fullscreenBtn, playerContainer, settingsBtn, settingsMenu,
        speedSubmenu, qualitySubmenu, speedOptionsContainer, qualityOptionsContainer
    ];
    if (essentialElements.every(el => el) && tabButtons.length > 0 && timelineList) {
         setupEventListeners();
         console.log("All essential elements found. Listeners set up.");
    } else {
        console.error("One or more essential control/UI elements missing. Some functionality may be disabled.");
        // Log missing elements for easier debugging
        essentialElements.forEach(el => {
            if (!el) console.error("Missing element:", el === playPauseBtn ? 'playPauseBtn' : el === seekBar ? 'seekBar' : /* ... add others if needed */ 'an essential element');
        });
         if (!settingsBtn) console.error("Missing: settingsBtn");
         if (!settingsMenu) console.error("Missing: settingsMenu");
         if (!speedSubmenu) console.error("Missing: speedSubmenu");
         if (!qualitySubmenu) console.error("Missing: qualitySubmenu");
         if (!speedOptionsContainer) console.error("Missing: speedOptionsContainer");
         if (!qualityOptionsContainer) console.error("Missing: qualityOptionsContainer");
    }

    // Initial UI Updates
    if (player && typeof player.getVolume === 'function') {
        updateVolumeUI(player.getVolume(), player.isMuted());
    }
    if (player && typeof player.getPlaybackRate === 'function') {
        updateSpeedDisplay(); // Update initial speed display
    }
    if (player && typeof player.getPlaybackQuality === 'function') {
        updateQualityDisplay(); // Update initial quality display
    }

    // Get duration with fallback
    const duration = player.getDuration();
    if (duration && duration > 0) {
         updateDurationDisplay(duration);
    } else {
         console.warn("Duration not available immediately in onReady. Will try again later.");
         if(timeDisplay) timeDisplay.textContent = `00:00 / --:--`;
         setTimeout(() => {
             const delayedDuration = player?.getDuration();
             if (delayedDuration && delayedDuration > 0) {
                 console.log("Duration obtained after delay:", delayedDuration);
                 updateDurationDisplay(delayedDuration);
             } else {
                 console.error("Failed to get duration even after delay.");
                 // Attempt to populate quality options anyway, API might still work
                 populateQualityOptions();
             }
         }, 1500);
    }
}

function updateDurationDisplay(duration) {
    if (isNaN(duration) || duration <= 0 || !seekBar || !progressBar || !timeDisplay) return;
    seekBar.max = duration;
    progressBar.max = duration;
    const currentTime = player?.getCurrentTime() || 0;
    timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
}

function onPlayerStateChange(event) {
    console.log(`Player State Change Detected: ${event.data}`); // Log state first

    // Try to get duration again if it wasn't ready before
    if ( (!seekBar.max || seekBar.max <= 0) && (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.CUED) ) {
        const duration = player?.getDuration();
        if (duration && duration > 0) {
            console.log("Updating duration from state change handler.");
            updateDurationDisplay(duration);
        }
    }

    switch (event.data) {
        case YT.PlayerState.PLAYING: // 1
             if(playPauseIcon) { playPauseIcon.className = 'fas fa-pause'; } // Ensure correct icon class
             if (overlayPlayButton) overlayPlayButton.classList.add('hidden');
             if (playerWrapper) playerWrapper.classList.remove('paused');
            startProgressUpdater();
            hideControlsAfterTimeout();
            break;

        case YT.PlayerState.PAUSED: // 2
             if(playPauseIcon) { playPauseIcon.className = 'fas fa-play'; } // Ensure correct icon class
            if (overlayPlayButton) overlayPlayButton.classList.remove('hidden');
            if (playerWrapper) playerWrapper.classList.add('paused');
            stopProgressUpdater();
            showControls(); // Keep controls visible
            break;

        case YT.PlayerState.ENDED: // 0
             if(playPauseIcon) { playPauseIcon.className = 'fas fa-play'; } // Ensure correct icon class
            if (overlayPlayButton) overlayPlayButton.classList.remove('hidden');
            if (playerWrapper) playerWrapper.classList.add('paused');
            stopProgressUpdater();
            if (seekBar) seekBar.value = 0;
            if (progressBar) progressBar.value = 0;
            const endDuration = player?.getDuration() || 0;
            if (timeDisplay) timeDisplay.textContent = `00:00 / ${formatTime(endDuration)}`;
            showControls();
            break;

        case YT.PlayerState.BUFFERING: // 3
            stopProgressUpdater(); // Pause updates while buffering
            break;

        case YT.PlayerState.CUED: // 5
            if (overlayPlayButton) overlayPlayButton.classList.remove('hidden');
            const cuedDuration = player?.getDuration();
            if (cuedDuration > 0) updateDurationDisplay(cuedDuration);
            // Quality might be known or changed by now
            if (player && typeof player.getPlaybackQuality === 'function') updateQualityDisplay();
            break;

         case YT.PlayerState.UNSTARTED: // -1
            if (overlayPlayButton) overlayPlayButton.classList.remove('hidden');
            break;

        default:
             console.log(`Unhandled player state: ${event.data}`);
    }

    // Update quality display frequently as it can change automatically
    if (player && typeof player.getPlaybackQuality === 'function') {
        setTimeout(updateQualityDisplay, 150); // Short delay for API update
    }
}

function onPlayerError(event) {
    stopProgressUpdater();
    let errorMessage = `An error occurred (Code: ${event.data}).`;
    switch (event.data) {
        case 2: errorMessage = "Error: Invalid video ID or request parameter."; break;
        case 5: errorMessage = "Error: Cannot play video in the HTML5 player."; break;
        case 100: errorMessage = "Error: Video not found or removed by user."; break;
        case 101:
        case 150: errorMessage = "Error: Video playback is restricted or disallowed by the owner."; break;
        default: errorMessage = `An unknown player error occurred (Code: ${event.data}).`;
    }
    console.error("YouTube Player Error Event:", event);
    showError(errorMessage);
}

// --- Progress Bar Update ---
function startProgressUpdater() {
    if (progressUpdateInterval) return;
    stopProgressUpdater(); // Clear existing interval just in case
    const duration = player?.getDuration();
    if (!duration || duration <= 0) {
        console.warn("Cannot start progress updater, duration unknown or zero.");
        return;
    }
    console.log("Starting progress updater");
    updateProgressBar(); // Initial update
    progressUpdateInterval = setInterval(updateProgressBar, 500);
}

function stopProgressUpdater() {
    if (progressUpdateInterval) {
        clearInterval(progressUpdateInterval);
        progressUpdateInterval = null;
    }
}

function updateProgressBar() {
    if (!player || typeof player.getCurrentTime !== 'function' || typeof player.getDuration !== 'function') {
        return;
    }
    const currentTime = player.getCurrentTime();
    const duration = player.getDuration();

    if (!isNaN(currentTime) && !isNaN(duration) && duration > 0 && seekBar && progressBar && timeDisplay) {
        seekBar.value = currentTime;
        progressBar.value = currentTime;
        timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    } else if (!isNaN(currentTime) && timeDisplay) {
         // Handle case where duration is still unknown/zero
         if (timeDisplay.textContent.includes('/ --:--') || duration <= 0) {
             timeDisplay.textContent = `${formatTime(currentTime)} / --:--`;
         }
    }
}

// --- UI Update Functions ---
function updateVolumeUI(volume, muted) {
    if (!volumeSlider || !volumeIcon || !volumeBtn) return;
    volumeSlider.value = muted ? 0 : volume;
    const label = muted || volume === 0 ? 'Unmute' : 'Mute';
    volumeBtn.setAttribute('aria-label', label);

    if (muted || volume === 0) {
        volumeIcon.className = 'fas fa-volume-xmark'; // Use full classes
    } else if (volume < 40) {
        volumeIcon.className = 'fas fa-volume-low'; // Use full classes
    } else {
        volumeIcon.className = 'fas fa-volume-high'; // Use full classes
    }
}

// NEW function to update speed display in main menu and highlight in submenu
function updateSpeedDisplay() {
    if (!player || typeof player.getPlaybackRate !== 'function' || !currentSpeedDisplay || !speedOptionsContainer) {
        console.warn("Cannot update speed display: Player or elements not ready.");
        return;
    }

    const currentRate = player.getPlaybackRate();
    const displayRate = currentRate === 1 ? 'Normal' : `${currentRate}x`;
    currentSpeedDisplay.textContent = `${displayRate} >`;

    // Update active state in submenu
    speedOptionsContainer.querySelectorAll('li').forEach(li => {
        const liSpeed = parseFloat(li.dataset.speed);
        const isActive = Math.abs(liSpeed - currentRate) < 0.01;
        li.classList.toggle('active', isActive);
        li.setAttribute('aria-checked', String(isActive)); // ARIA state expects string "true"/"false"
    });
    console.log(`UI Updated: Speed display set to ${displayRate}`);
}

// NEW function to update quality display in main menu and highlight in submenu
function updateQualityDisplay() {
    if (!player || typeof player.getPlaybackQuality !== 'function' || !currentQualityDisplay || !qualityOptionsContainer) {
        console.warn("Cannot update quality display: Player or elements not ready.");
        if (currentQualityDisplay) currentQualityDisplay.textContent = 'Auto >'; // Default fallback display
        return;
    }

    const currentQuality = player.getPlaybackQuality(); // e.g., "hd720", "auto"

    // Map quality levels to human-readable names
    const qualityMap = {
        'hd2160': '2160p', 'hd1440': '1440p', 'hd1080': '1080p', 'hd720': '720p',
        'large': '480p', 'medium': '360p', 'small': '240p', 'tiny': '144p', 'auto': 'Auto'
    };
    const displayQuality = qualityMap[currentQuality] || currentQuality; // Fallback to raw name if not in map
    currentQualityDisplay.textContent = `${displayQuality} >`;

    // Update active state in quality submenu (if populated)
    qualityOptionsContainer.querySelectorAll('li').forEach(li => {
        const liQuality = li.dataset.quality;
        const isActive = liQuality === currentQuality;
        li.classList.toggle('active', isActive);
        li.setAttribute('aria-checked', String(isActive));
    });
     console.log(`UI Updated: Quality display set to ${displayQuality} (${currentQuality})`);
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    console.log("Setting up event listeners...");

    // --- Basic Controls ---
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (overlayPlayButton) overlayPlayButton.addEventListener('click', togglePlayPause);
    if (seekBar) { seekBar.addEventListener('input', handleSeekInput); seekBar.addEventListener('change', handleSeekChange); }
    if (volumeBtn) volumeBtn.addEventListener('click', toggleMute);
    if (volumeSlider) volumeSlider.addEventListener('input', handleVolumeChange);
    if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    // --- Tab Switching Logic ---
    if (tabButtons.length > 0 && tabContents.length > 0) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTabId = button.dataset.target;
                if (!targetTabId) { console.warn("Tab button missing data-target attribute:", button); return; }
                const targetTabContent = document.getElementById(targetTabId);
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));
                button.classList.add('active');
                if (targetTabContent) targetTabContent.classList.add('active');
                else console.warn(`Tab content element with ID '${targetTabId}' not found.`);
            });
        });
    } else { console.warn("Tab buttons or content elements not found, tab switching disabled."); }

    // --- Timeline Click-to-Seek Logic ---
    if (timelineList) {
        timelineList.addEventListener('click', handleTimelineItemClick);
        timelineList.addEventListener('keydown', handleTimelineItemKeydown);
    } else { console.warn("Timeline list container (#timeline-list) not found. Timeline seeking disabled."); }

     // --- Rating Stars Logic ---
     if (ratingStars.length > 0 && ratingFeedback) {
         ratingStars.forEach(star => {
            star.addEventListener('mouseover', handleStarHover);
            star.addEventListener('mouseout', handleStarMouseOut);
            star.addEventListener('click', handleStarClick);
         });
     }

    // --- Hide/Show Controls Logic ---
    if (playerWrapper && controlsContainer) {
        playerWrapper.addEventListener('mousemove', showControls);
        controlsContainer.addEventListener('mouseenter', showControls);
        controlsContainer.addEventListener('mouseleave', hideControlsAfterTimeout);
        playerWrapper.addEventListener('focusin', showControls); // Show on focus within wrapper
        playerWrapper.addEventListener('focusout', hideControlsAfterTimeout); // Hide potentially after focus leaves
        showControls(); // Initial setup
        hideControlsAfterTimeout();
    }

    // --- Click/Double-Click on Video Area ---
    if (playerContainer) {
        playerContainer.addEventListener('click', handleVideoAreaClick);
        playerContainer.addEventListener('dblclick', handleVideoAreaDoubleClick);
    } else { console.error("playerContainer missing, cannot add click/dblclick listeners."); }

    // --- NEW Settings Menu Logic ---
    if (settingsBtn && settingsMenu && speedSubmenu && qualitySubmenu && speedOptionsContainer && qualityOptionsContainer) {

        // Toggle main settings menu
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent document click listener below
            const isHidden = settingsMenu.classList.toggle('hidden');
            settingsBtn.setAttribute('aria-expanded', String(!isHidden));
            // Always hide submenus when toggling main menu
            speedSubmenu.classList.add('hidden');
            qualitySubmenu.classList.add('hidden');
            console.log(`Settings menu toggled: ${isHidden ? 'hidden' : 'visible'}`);
        });

        // Handle clicks within the main menu (to open submenus)
        settingsMenu.addEventListener('click', (e) => {
            const item = e.target.closest('[data-action]');
            if (!item) return; // Clicked inside menu but not on an action item
            e.stopPropagation(); // Prevent document click listener

            const action = item.dataset.action;
            settingsMenu.classList.add('hidden'); // Hide main menu after click
            settingsBtn.setAttribute('aria-expanded', 'false');

            if (action === 'open-speed-submenu') {
                console.log("Opening speed submenu");
                updateSpeedDisplay(); // Ensure display is current
                speedSubmenu.classList.remove('hidden');
            } else if (action === 'open-quality-submenu') {
                console.log("Opening quality submenu");
                populateQualityOptions(); // Populate/Repopulate before showing
                qualitySubmenu.classList.remove('hidden');
            }
        });

        // Handle clicks within the speed submenu
        speedSubmenu.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent document click listener
            const target = e.target.closest('[data-action], li[data-speed]');
            if (!target) return;

            if (target.dataset.action === 'close-submenu') {
                console.log("Closing speed submenu, returning to main");
                speedSubmenu.classList.add('hidden');
                settingsMenu.classList.remove('hidden');
                settingsBtn.setAttribute('aria-expanded', 'true');
            } else if (target.dataset.speed) {
                const speed = parseFloat(target.dataset.speed);
                if (!isNaN(speed) && player && typeof player.setPlaybackRate === 'function') {
                    console.log(`Setting playback speed to: ${speed}`);
                    player.setPlaybackRate(speed);
                    updateSpeedDisplay();
                    speedSubmenu.classList.add('hidden'); // Close after selection
                    settingsBtn.setAttribute('aria-expanded', 'false');
                }
            }
        });

         // Handle clicks within the quality submenu
        qualitySubmenu.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent document click listener
            const target = e.target.closest('[data-action], li[data-quality]');
            if (!target) return;

            if (target.dataset.action === 'close-submenu') {
                console.log("Closing quality submenu, returning to main");
                qualitySubmenu.classList.add('hidden');
                settingsMenu.classList.remove('hidden');
                settingsBtn.setAttribute('aria-expanded', 'true');
            } else if (target.dataset.quality) {
                const quality = target.dataset.quality;
                if (player && typeof player.setPlaybackQuality === 'function') {
                    console.log(`Requesting quality change to: ${quality}`);
                    player.setPlaybackQuality(quality);
                    // Don't call updateQualityDisplay() immediately here.
                    // Let onPlayerStateChange handle the update after the API confirms.
                    qualitySubmenu.classList.add('hidden'); // Close after selection
                    settingsBtn.setAttribute('aria-expanded', 'false');
                }
            }
        });

        // Close ALL menus if clicking anywhere else on the document
        document.addEventListener('click', (e) => {
            // Check if the click is outside the button AND all menus
            if (!settingsBtn.contains(e.target) && !settingsMenu.contains(e.target) && !speedSubmenu.contains(e.target) && !qualitySubmenu.contains(e.target)) {
                // Only log if a menu was actually open
                if (!settingsMenu.classList.contains('hidden') || !speedSubmenu.classList.contains('hidden') || !qualitySubmenu.classList.contains('hidden')) {
                    console.log("Clicked outside settings menus, closing all.");
                }
                settingsMenu.classList.add('hidden');
                speedSubmenu.classList.add('hidden');
                qualitySubmenu.classList.add('hidden');
                settingsBtn.setAttribute('aria-expanded', 'false');
            }
        });

        // Add keydown listeners for basic menu navigation (optional but good for a11y)
        settingsMenu.addEventListener('keydown', handleMenuKeydown);
        speedSubmenu.addEventListener('keydown', handleMenuKeydown);
        qualitySubmenu.addEventListener('keydown', handleMenuKeydown);

    } else {
        console.warn("Settings menu elements not found, settings functionality disabled.");
        if (settingsBtn) settingsBtn.style.display = 'none'; // Hide the button if menus are missing
    }
}

// --- NEW Function to Populate Quality Options ---
function populateQualityOptions() {
    if (!player || typeof player.getAvailableQualityLevels !== 'function' || !qualityOptionsContainer || !currentQualityDisplay) {
        console.warn("Cannot populate quality options: Player or elements not ready.");
        qualityOptionsContainer.innerHTML = '<li class="info-message" aria-disabled="true">Unavailable</li>';
        return;
    }

    const availableQualities = player.getAvailableQualityLevels(); // e.g., ["hd1080", "hd720", ...]
    const currentQuality = player.getPlaybackQuality(); // e.g., "hd720"

    // Map API names to display names
    const qualityMap = {
        'hd2160': '2160p', 'hd1440': '1440p', 'hd1080': '1080p', 'hd720': '720p',
        'large': '480p', 'medium': '360p', 'small': '240p', 'tiny': '144p', 'auto': 'Auto'
    };

    console.log("Populating Quality Options - Available:", availableQualities, "Current:", currentQuality);
    qualityOptionsContainer.innerHTML = ''; // Clear previous options

    if (!availableQualities || availableQualities.length === 0) {
        console.warn("API returned no available quality levels.");
         qualityOptionsContainer.innerHTML = '<li class="info-message" aria-disabled="true">Unavailable</li>';
         currentQualityDisplay.textContent = 'Auto >'; // Default display
         return;
    }

    // Add "Auto" option first
    const autoLi = document.createElement('li');
    autoLi.textContent = qualityMap['auto'];
    autoLi.dataset.quality = 'auto';
    autoLi.setAttribute('role', 'menuitemradio');
    autoLi.tabIndex = -1; // Manage focus programmatically
    const isAutoActive = currentQuality === 'auto'; // Treat Auto distinctly
    autoLi.classList.toggle('active', isAutoActive);
    autoLi.setAttribute('aria-checked', String(isAutoActive));
    qualityOptionsContainer.appendChild(autoLi);

    // Define a preferred order for display (highest to lowest)
    const qualityOrder = ['hd2160', 'hd1440', 'hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];
    // Filter available qualities based on the preferred order and add them
    qualityOrder.forEach(level => {
        if (availableQualities.includes(level)) {
            const qualityName = qualityMap[level] || level;
            const li = document.createElement('li');
            li.textContent = qualityName;
            li.dataset.quality = level;
            li.setAttribute('role', 'menuitemradio');
            li.tabIndex = -1;
            const isActive = level === currentQuality;
            li.classList.toggle('active', isActive);
            li.setAttribute('aria-checked', String(isActive));
            qualityOptionsContainer.appendChild(li);
        }
    });

    // Update the main menu display text based on current quality
    updateQualityDisplay();
}

// --- NEW Handler for Keyboard Navigation in Menus (Basic Example) ---
function handleMenuKeydown(event) {
    const menu = event.currentTarget; // The menu div/ul where the event occurred
    const items = Array.from(menu.querySelectorAll('[role^="menuitem"]')); // Get all focusable items
    if (!items.length) return;

    let currentItemIndex = items.findIndex(item => item === document.activeElement);

    switch (event.key) {
        case 'ArrowUp':
            event.preventDefault();
            currentItemIndex = (currentItemIndex > 0) ? currentItemIndex - 1 : items.length - 1;
            items[currentItemIndex]?.focus();
            break;
        case 'ArrowDown':
            event.preventDefault();
            currentItemIndex = (currentItemIndex < items.length - 1) ? currentItemIndex + 1 : 0;
            items[currentItemIndex]?.focus();
            break;
        case 'Enter':
        case ' ': // Spacebar
            event.preventDefault();
            document.activeElement?.click(); // Simulate a click on the focused item
            break;
        case 'Escape':
            event.preventDefault();
            // Close the current menu and potentially return to the parent
            if (menu === speedSubmenu || menu === qualitySubmenu) {
                menu.classList.add('hidden');
                settingsMenu.classList.remove('hidden');
                settingsBtn.setAttribute('aria-expanded', 'true');
                settingsMenu.querySelector('[data-action^="open"]')?.focus(); // Focus first item in main menu
            } else if (menu === settingsMenu) {
                settingsMenu.classList.add('hidden');
                settingsBtn.setAttribute('aria-expanded', 'false');
                settingsBtn.focus(); // Focus back on the settings button
            }
            break;
        case 'Tab':
            // Allow tabbing out of the menu - document listener will close it
            break;
    }
}


// --- Timeline Handlers ---
function handleTimelineItemClick(event) {
    const timelineItem = event.target.closest('.timeline-item');
    seekToTimelineItem(timelineItem);
}

function handleTimelineItemKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        const timelineItem = event.target.closest('.timeline-item');
        if (timelineItem) { event.preventDefault(); seekToTimelineItem(timelineItem); }
    }
}

function seekToTimelineItem(timelineItem) {
    if (timelineItem?.dataset.time !== undefined) {
        const time = parseFloat(timelineItem.dataset.time);
        if (!isNaN(time) && player?.seekTo) {
            console.log(`Timeline Seek: Requesting seek to ${time}s`);
            player.seekTo(time, true);
        } else { console.warn("Timeline seek failed", { time, playerExists: !!player }); }
    }
}

// --- Video Area Click/Double-Click Handlers ---
function handleVideoAreaClick(event) {
    // Prevent toggle if click is on controls, overlay button, or seek/progress bar
    if (controlsContainer?.contains(event.target) ||
        overlayPlayButton?.contains(event.target) ||
        event.target === seekBar || event.target === progressBar) {
        return; // Ignore click
    }
    togglePlayPause();
}

function handleVideoAreaDoubleClick(event) {
    if (!player || !player.getCurrentTime || !player.getDuration || !player.seekTo) return;
    // Prevent seek if double-click is on controls or overlay button
    if (controlsContainer?.contains(event.target) || overlayPlayButton?.contains(event.target)) {
        return; // Ignore double-click
    }

    const rect = playerContainer.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const containerWidth = playerContainer.offsetWidth;
    const currentTime = player.getCurrentTime();
    const duration = player.getDuration();
    let newTime = currentTime;
    const skipAmount = 10; // Seconds to skip

    if (clickX > containerWidth / 2) { // Right half
        newTime = Math.min(currentTime + skipAmount, duration); // Clamp to duration
        console.log(`Double-click right: Seeking +${skipAmount}s to ${newTime.toFixed(2)}`);
    } else { // Left half
        newTime = Math.max(currentTime - skipAmount, 0); // Clamp to 0
        console.log(`Double-click left: Seeking -${skipAmount}s to ${newTime.toFixed(2)}`);
    }

    player.seekTo(newTime, true);
    // Immediately update UI for responsiveness
    if (progressBar) progressBar.value = newTime;
    if (seekBar) seekBar.value = newTime;
    if (timeDisplay) timeDisplay.textContent = `${formatTime(newTime)} / ${formatTime(duration)}`;
}


// --- Control Action Handlers ---
function togglePlayPause() {
    if (!player || typeof player.getPlayerState !== 'function') return;
    const state = player.getPlayerState();
    // Play unless already playing or buffering
    if (state !== YT.PlayerState.PLAYING && state !== YT.PlayerState.BUFFERING) {
        player.playVideo();
    } else {
        player.pauseVideo();
    }
}

function handleSeekInput(event) {
     if (!player || typeof player.getDuration !== 'function' || !timeDisplay || !seekBar || !progressBar) return;
     const duration = player.getDuration();
     const seekTime = parseFloat(event.target.value);
     if (!isNaN(duration) && duration > 0 && !isNaN(seekTime)) {
        timeDisplay.textContent = `${formatTime(seekTime)} / ${formatTime(duration)}`;
        progressBar.value = seekTime; // Update progress visually during scrub
     }
}

function handleSeekChange(event) {
    if (!player || typeof player.seekTo !== 'function' || !seekBar || !progressBar) return;
    const time = parseFloat(event.target.value);
    if (!isNaN(time)) {
        console.log(`Seek Bar Change: Requesting seek to ${time}`);
        player.seekTo(time, true);
        progressBar.value = time; // Ensure progress matches final seek value
    }
}

function toggleMute() {
    if (!player || typeof player.isMuted !== 'function') return;
    if (player.isMuted()) {
        player.unMute();
    } else {
        player.mute();
    }
    // Update UI immediately regardless of API latency
    updateVolumeUI(player.getVolume(), player.isMuted());
}

function handleVolumeChange(event) {
    if (!player || typeof player.setVolume !== 'function' || !volumeSlider) return;
    const volume = parseInt(event.target.value, 10);
    if (player.isMuted() && volume > 0) {
        player.unMute(); // Unmute if slider is moved from 0
    }
    player.setVolume(volume);
    updateVolumeUI(volume, player.isMuted()); // Update UI immediately
}

function toggleFullscreen() {
     if (!playerWrapper) return;
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
        console.log("Entering fullscreen");
        // Try standard first, then vendor prefixes
        if (playerWrapper.requestFullscreen) playerWrapper.requestFullscreen();
        else if (playerWrapper.webkitRequestFullscreen) playerWrapper.webkitRequestFullscreen();
        else if (playerWrapper.mozRequestFullScreen) playerWrapper.mozRequestFullScreen();
        else if (playerWrapper.msRequestFullscreen) playerWrapper.msRequestFullscreen();
        else console.error("Fullscreen API is not supported by this browser.");
    } else {
        console.log("Exiting fullscreen");
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
    }
}

function handleFullscreenChange() {
    if (!fullscreenBtn || !playerWrapper) return;
    const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    const icon = fullscreenBtn.querySelector('i');
    if (isFullscreen) {
        console.log("Browser entered fullscreen mode.");
        if(icon) { icon.className = 'fas fa-compress'; } // Update icon class
        playerWrapper.classList.add('fullscreen-active');
        fullscreenBtn.setAttribute('aria-label', 'Exit Fullscreen');
    } else {
        console.log("Browser exited fullscreen mode.");
        if(icon) { icon.className = 'fas fa-expand'; } // Update icon class
        playerWrapper.classList.remove('fullscreen-active');
        fullscreenBtn.setAttribute('aria-label', 'Enter Fullscreen');
    }
}

// --- Controls Visibility Handlers ---
function showControls() {
    if (!controlsContainer || !playerWrapper) return;
    clearTimeout(controlsTimeout);
    controlsContainer.classList.remove('hidden');
    controlsContainer.style.opacity = '1';
    playerWrapper.style.cursor = ''; // Show cursor
}

function hideControlsAfterTimeout() {
     if (!controlsContainer || !playerWrapper || !player?.getPlayerState) return;
    clearTimeout(controlsTimeout);
    // Only hide if playing and mouse/focus is not over controls or menus
    const menusAreOpen = !settingsMenu?.classList.contains('hidden') ||
                         !speedSubmenu?.classList.contains('hidden') ||
                         !qualitySubmenu?.classList.contains('hidden');
    const focusInsideControls = controlsContainer.contains(document.activeElement);

    if (player.getPlayerState() === YT.PlayerState.PLAYING &&
        !controlsContainer.matches(':hover') &&
        !menusAreOpen &&
        !focusInsideControls) {

        controlsTimeout = setTimeout(() => {
            // Double check conditions before hiding
            const stillPlaying = player?.getPlayerState() === YT.PlayerState.PLAYING;
            const stillNotHovering = !controlsContainer?.matches(':hover');
            const stillMenusClosed = settingsMenu?.classList.contains('hidden') &&
                                   speedSubmenu?.classList.contains('hidden') &&
                                   qualitySubmenu?.classList.contains('hidden');
            const stillNotFocused = !controlsContainer?.contains(document.activeElement);

            if (stillPlaying && stillNotHovering && stillMenusClosed && stillNotFocused) {
                if (controlsContainer) {
                    controlsContainer.classList.add('hidden');
                    controlsContainer.style.opacity = '0';
                }
                if (playerWrapper) {
                    playerWrapper.style.cursor = 'none'; // Hide cursor
                }
            }
        }, 3000); // 3 seconds delay
    }
}

// --- Optional Rating Star Handlers ---
let currentRating = 0;
function handleStarHover(event) {
    if (!event.target.dataset.value || !ratingStars) return;
    const hoverValue = parseInt(event.target.dataset.value, 10);
    ratingStars.forEach((star, index) => {
        const isHovered = index < hoverValue;
        star.classList.toggle('hover', isHovered);
        // Update both fas/far and selected state based on hover, not currentRating
        star.className = `fa-${isHovered ? 's' : 'r'} fa-star ${isHovered ? 'hover' : ''} ${star.classList.contains('selected') && !isHovered ? 'selected' : ''}`;
    });
}

function handleStarMouseOut() {
    if (!ratingStars) return;
    ratingStars.forEach((star, index) => {
        star.classList.remove('hover');
        // Reset based on currentRating
        const isSelected = index < currentRating;
        star.classList.toggle('selected', isSelected);
        star.className = `fa-${isSelected ? 's' : 'r'} fa-star ${isSelected ? 'selected' : ''}`;
    });
}

function handleStarClick(event) {
    if (!event.target.dataset.value || !ratingFeedback || !ratingStars) return;
    currentRating = parseInt(event.target.dataset.value, 10);
    ratingStars.forEach((star, index) => {
        const isSelected = index < currentRating;
        star.classList.remove('hover'); // Remove hover state on click
        star.classList.toggle('selected', isSelected);
        star.className = `fa-${isSelected ? 's' : 'r'} fa-star ${isSelected ? 'selected' : ''}`;
    });
    ratingFeedback.textContent = `Thank you for rating ${currentRating} out of 5!`;
    ratingFeedback.classList.remove('hidden');
    console.log(`Rating submitted: ${currentRating}`);
    // TODO: Send rating to backend if needed
}

// --- Initial Check ---
console.log("player.js loaded. Waiting for onYouTubeIframeAPIReady callback...");