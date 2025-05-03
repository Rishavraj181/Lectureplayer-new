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
const loadingIndicator = document.getElementById('loading');
const seekBar = document.getElementById('seek-bar');
const progressBar = document.getElementById('progress-bar');
const timeDisplay = document.getElementById('time-display');
const volumeBtn = document.getElementById('volume-btn');
const volumeIcon = volumeBtn?.querySelector('i'); // Use optional chaining ?
const volumeSlider = document.getElementById('volume-slider');
// --- Speed Control Elements (Ensure these IDs exist in HTML if used) ---
const speedBtn = document.getElementById('speed-btn'); // Might be null if HTML missing
const speedDisplay = document.getElementById('speed-display'); // Might be null
const speedOptionsList = document.getElementById('speed-options-list'); // Might be null
// --- ---
const fullscreenBtn = document.getElementById('fullscreen-btn');
const controlsContainer = document.getElementById('controls');
const errorMessageElement = document.getElementById('error-message');

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

function showLoading(show) {
    if (loadingIndicator) {
        loadingIndicator.classList.toggle('hidden', !show);
    }
}

function showError(message) {
     if (errorMessageElement) {
        errorMessageElement.textContent = message;
        errorMessageElement.classList.remove('hidden');
     }
     showLoading(false);
     if (controlsContainer) {
        controlsContainer.classList.add('hidden'); // Hide controls on error
        controlsContainer.style.opacity = '0'; // Ensure hidden visually
     }
     if (playerContainer) {
        // Maybe show a placeholder error image or message in the player area
        playerContainer.innerHTML = `<div style="color: red; text-align: center; padding: 20px;">${message}</div>`;
     }
     console.error("Player Error:", message);
}

// --- Function to Fetch and Populate Data ---
async function loadDynamicContent(videoId) {
    // Ensure all list containers exist (check needed elements)
    if (!studyMaterialList || !relatedVideosList || !timelineList) {
        console.error("Dynamic content list containers not found! Cannot load data.");
        // Optionally display errors in the respective tabs if elements are missing
        if (!studyMaterialList && document.getElementById('study-material-content')) {
            document.getElementById('study-material-content').innerHTML = '<h2>Study Material</h2><p class="error">Error: Target list area (#study-material-list) missing in HTML.</p>';
        }
        // Add similar checks/errors for relatedVideosList and timelineList if needed
        return;
    }

    // Clear existing content and show loading messages
    studyMaterialList.innerHTML = '<p class="loading-message">Loading materials...</p>';
    relatedVideosList.innerHTML = '<p class="loading-message">Loading related videos...</p>';
    timelineList.innerHTML = '<p class="loading-message">Loading timeline...</p>';

    try {
        console.log("Fetching video_data.json...");
        const response = await fetch('video_data.json'); // Fetch the JSON file
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status} while fetching video_data.json`);
        }
        const allData = await response.json();
        console.log("Fetched data:", allData);

        // **** CORRECTED ACCESS ****
        const videoData = allData.videos ? allData.videos[videoId] : null; // Access nested data

        if (!videoData) {
             console.warn(`No data found in video_data.json for video ID: ${videoId}`);
             studyMaterialList.innerHTML = '<p class="info-message">No study materials available for this video.</p>';
             relatedVideosList.innerHTML = '<p class="info-message">No related videos available for this video.</p>';
             timelineList.innerHTML = '<p class="info-message">No timeline available for this video.</p>';
             return; // Stop further processing if no data for this video
        }

        // --- Populate Study Materials ---
        studyMaterialList.innerHTML = ''; // Clear loading message
        if (videoData.studyMaterials && videoData.studyMaterials.length > 0) {
            videoData.studyMaterials.forEach(item => {
                const div = document.createElement('div');
                div.className = 'material-item';

                const span = document.createElement('span');
                span.textContent = item.title || 'Untitled Material'; // Fallback title

                const link = document.createElement('a');
                link.href = item.url || '#'; // Fallback URL
                // Open external links and PDFs in new tabs
                if (item.external || (item.url && (item.url.toLowerCase().endsWith('.pdf') || item.url.startsWith('http')))) {
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer'; // Security best practice
                }

                const button = document.createElement('button');
                button.className = 'view-button';
                button.textContent = 'View';

                link.appendChild(button);
                div.appendChild(span);
                div.appendChild(link);
                studyMaterialList.appendChild(div);
            });
        } else {
            studyMaterialList.innerHTML = '<p class="info-message">No study materials available for this video.</p>';
        }

        // --- Populate Related Videos ---
        relatedVideosList.innerHTML = ''; // Clear loading message
        if (videoData.relatedVideos && videoData.relatedVideos.length > 0) {
            videoData.relatedVideos.forEach(item => {
                if (!item.youtubeId || !item.title) {
                    console.warn("Skipping related video item due to missing data:", item);
                    return; // Skip incomplete items
                }
                const div = document.createElement('div');
                div.className = 'material-item'; // Re-use styling

                const span = document.createElement('span');
                span.textContent = item.title;

                // Build URL for the player page with the related video ID and title
                const playerUrl = new URL(window.location.pathname, window.location.origin);
                playerUrl.searchParams.set('youtubeId', item.youtubeId);
                // Use baseTitle if present, otherwise use the item title for the URL param (replace spaces)
                const urlTitle = item.baseTitle || item.title;
                playerUrl.searchParams.set('title', urlTitle.replace(/ /g, '_'));

                const link = document.createElement('a');
                link.href = playerUrl.toString(); // Link to the player page

                const button = document.createElement('button');
                button.className = 'view-button';
                button.textContent = 'Watch';

                link.appendChild(button);
                div.appendChild(span);
                div.appendChild(link);
                relatedVideosList.appendChild(div);
            });
        } else {
            relatedVideosList.innerHTML = '<p class="info-message">No related videos available for this video.</p>';
        }

        // --- Populate Timeline / Chapters --- //
        timelineList.innerHTML = ''; // Clear loading message
        if (videoData.timeline && videoData.timeline.length > 0) {
            videoData.timeline.forEach(chapter => {
                 if (typeof chapter.time !== 'number' || !chapter.title) {
                     console.warn("Skipping invalid timeline chapter:", chapter);
                     return; // Skip malformed chapter
                 }
                const div = document.createElement('div');
                div.className = 'timeline-item'; // Add class for styling and event listener
                div.dataset.time = chapter.time; // Store time in data attribute
                div.textContent = `${formatTime(chapter.time)} - ${chapter.title}`;
                div.setAttribute('role', 'button'); // Accessibility
                div.tabIndex = 0; // Make focusable

                timelineList.appendChild(div);
            });
        } else {
            timelineList.innerHTML = '<p class="info-message">No timeline available for this video.</p>';
        }


    } catch (error) {
        console.error('Error loading or processing dynamic content:', error);
        // Display errors in the UI
        studyMaterialList.innerHTML = `<p class="error">Error loading materials: ${error.message}</p>`;
        relatedVideosList.innerHTML = `<p class="error">Error loading related videos: ${error.message}</p>`;
        timelineList.innerHTML = `<p class="error">Error loading timeline: ${error.message}</p>`;
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
        document.title = currentVideoTitle; // Update page title
    } else {
         if (videoTitleElement) videoTitleElement.textContent = "Video Player";
         document.title = "Video Player";
    }

    if (!currentVideoId) {
        showError("Error: No 'youtubeId' parameter found in the URL.");
        return;
    }

    // Start loading dynamic content ASAP (runs async)
    loadDynamicContent(currentVideoId);

     showLoading(true);
     if (errorMessageElement) errorMessageElement.classList.add('hidden'); // Hide previous errors

    try {
        if (!document.getElementById('youtube-player')) {
             throw new Error("Player container div #youtube-player not found in HTML.");
        }

        player = new YT.Player('youtube-player', {
            height: '100%',
            width: '100%',
            videoId: currentVideoId,
            // **** ADDED/UPDATED playerVars ****
            playerVars: {
                'playsinline': 1,       // Essential for mobile inline playback
                'autoplay': 0,          // Don't autoplay
                'controls': 0,          // <--- HIDE YouTube's default controls
                'rel': 0,               // Don't show related videos suggested by YouTube
                'showinfo': 0,          // Deprecated, but include for older compatibility
                'modestbranding': 1,    // Less prominent YouTube logo
                'iv_load_policy': 3,    // Don't show video annotations by default
                'disablekb': 1          // Disable YT keyboard shortcuts if using custom ones
                // 'origin': window.location.origin // Might be needed for some embeds
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError
            }
        });
    } catch (error) {
         showError(`Failed to create YouTube player instance: ${error.message}`);
         console.error(error); // Log full error
    }
};

// --- YouTube Player Event Handlers ---

function onPlayerReady(event) {
    console.log("Player Ready:", currentVideoId);
    showLoading(false);
    if (overlayPlayButton) overlayPlayButton.classList.remove('hidden'); // Show overlay play button now
    if (controlsContainer) controlsContainer.classList.remove('hidden'); // Show custom controls

    // Make sure elements exist before setting up listeners or updating UI
    if (playPauseBtn && seekBar && timeDisplay && volumeBtn && volumeSlider && fullscreenBtn && tabButtons.length > 0 && timelineList) {
         setupEventListeners();
    } else {
        console.error("One or more essential control/UI elements missing, cannot setup listeners correctly.");
        // Consider showing an error message if core controls are missing
    }

    if (player && typeof player.getVolume === 'function') {
        updateVolumeUI(player.getVolume(), player.isMuted());
    }
     if (player && typeof player.getPlaybackRate === 'function' && speedDisplay) { // Check speedDisplay too
        updatePlaybackSpeedUI(player.getPlaybackRate());
     }


    // Get duration with fallback
    const duration = player.getDuration();
    if (duration && duration > 0) {
         updateDurationDisplay(duration);
         startProgressUpdater(); // Start updater only when duration is known
    } else {
         console.warn("Duration not available immediately in onReady. Will try again on state change or after delay.");
         if(timeDisplay) timeDisplay.textContent = `00:00 / --:--`;
         // Fallback check after a short delay
         setTimeout(() => {
             const delayedDuration = player.getDuration();
             if (delayedDuration && delayedDuration > 0) {
                 console.log("Duration obtained after delay:", delayedDuration);
                 updateDurationDisplay(delayedDuration);
                 startProgressUpdater(); // Start updater now
             } else {
                 console.error("Failed to get duration even after delay.");
             }
         }, 1000);
    }
}

function updateDurationDisplay(duration) {
    if (isNaN(duration) || duration <= 0 || !seekBar || !progressBar || !timeDisplay) return; // Add checks
    seekBar.max = duration;
    progressBar.max = duration;
    const currentTime = player?.getCurrentTime() || 0;
    timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
}


function onPlayerStateChange(event) {
    console.log("Player State Change:", event.data, YT.PlayerState);

     // Try to get duration again if it wasn't ready before
     if ( (!seekBar.max || seekBar.max <= 0) && (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.PAUSED) ) {
        const duration = player.getDuration();
        if (duration > 0) {
            updateDurationDisplay(duration);
            if (!progressUpdateInterval) startProgressUpdater(); // Start if not already started
        }
     }


    switch (event.data) {
        case YT.PlayerState.PLAYING:
             if(playPauseIcon) {
                playPauseIcon.classList.remove('fa-play');
                playPauseIcon.classList.add('fa-pause');
             }
             if (overlayPlayButton) overlayPlayButton.classList.add('hidden');
             if (playerWrapper) playerWrapper.classList.remove('paused'); // For CSS hooks
            startProgressUpdater();
            hideControlsAfterTimeout(); // Start timer to hide controls
            break;
        case YT.PlayerState.PAUSED:
             if(playPauseIcon) {
                playPauseIcon.classList.remove('fa-pause');
                playPauseIcon.classList.add('fa-play');
             }
            if (overlayPlayButton) overlayPlayButton.classList.remove('hidden');
            if (playerWrapper) playerWrapper.classList.add('paused'); // For CSS hooks
            stopProgressUpdater();
            showControls(); // Keep controls visible when paused
            break;
        case YT.PlayerState.ENDED:
             if(playPauseIcon) {
                playPauseIcon.classList.remove('fa-pause');
                playPauseIcon.classList.add('fa-play');
             }
            if (overlayPlayButton) overlayPlayButton.classList.remove('hidden'); // Show overlay to replay?
            if (playerWrapper) playerWrapper.classList.add('paused');
            stopProgressUpdater();
            // Reset progress to beginning
            if (seekBar) seekBar.value = 0;
            if (progressBar) progressBar.value = 0;
            const endDuration = player?.getDuration() || 0;
            if (timeDisplay) timeDisplay.textContent = `00:00 / ${formatTime(endDuration)}`;
            showControls(); // Keep controls visible at end
            break;
        case YT.PlayerState.BUFFERING:
            showLoading(true);
            stopProgressUpdater(); // Pause updates while buffering
            break;
        case YT.PlayerState.CUED: // Video loaded, ready to play
            showLoading(false);
             if (overlayPlayButton) overlayPlayButton.classList.remove('hidden');
             updateDurationDisplay(player.getDuration()); // Update duration display if cued
            break;
         case YT.PlayerState.UNSTARTED: // Initial state
            showLoading(false); // Often transitions too fast, hide loading unless buffering happens
            if (overlayPlayButton) overlayPlayButton.classList.remove('hidden');
            break;

    }
}

function onPlayerError(event) {
    stopProgressUpdater();
    showLoading(false);
    let errorMessage = `An error occurred (Code: ${event.data}).`;
     // Provide more specific messages based on YouTube API error codes
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
    if (progressUpdateInterval) return; // Already running
    stopProgressUpdater(); // Clear any residual interval
    console.log("Starting progress updater");
    updateProgressBar(); // Update once immediately
    progressUpdateInterval = setInterval(updateProgressBar, 500); // Update ~twice per second
}

function stopProgressUpdater() {
    if (progressUpdateInterval) {
        // console.log("Stopping progress updater");
        clearInterval(progressUpdateInterval);
        progressUpdateInterval = null;
    }
}

function updateProgressBar() {
    if (!player || typeof player.getCurrentTime !== 'function' || typeof player.getDuration !== 'function') {
        // console.warn("Cannot update progress bar, player not ready or methods unavailable.");
        return;
    }
    const currentTime = player.getCurrentTime();
    const duration = player.getDuration();

    // Ensure duration is valid and elements exist
    if (!isNaN(currentTime) && !isNaN(duration) && duration > 0 && seekBar && progressBar && timeDisplay) {
        seekBar.value = currentTime;
        progressBar.value = currentTime; // Update visual progress
        timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
    } else if (!isNaN(currentTime) && timeDisplay) {
         // Handle cases like live streams (duration=0) or if duration isn't known yet
         if (timeDisplay.textContent.endsWith('/ --:--') || duration <= 0) {
             timeDisplay.textContent = `${formatTime(currentTime)} / --:--`;
         }
    }
}

// --- UI Update Functions ---
function updateVolumeUI(volume, muted) {
    if (!volumeSlider || !volumeIcon) return;
    volumeSlider.value = muted ? 0 : volume;
    if (muted || volume === 0) {
        volumeIcon.classList.remove('fa-volume-high', 'fa-volume-low');
        volumeIcon.classList.add('fa-volume-xmark');
        volumeBtn.setAttribute('aria-label', 'Unmute');
    } else if (volume < 40) {
         volumeIcon.classList.remove('fa-volume-high', 'fa-volume-xmark');
        volumeIcon.classList.add('fa-volume-low');
         volumeBtn.setAttribute('aria-label', 'Mute');
    } else {
        volumeIcon.classList.remove('fa-volume-low', 'fa-volume-xmark');
        volumeIcon.classList.add('fa-volume-high');
         volumeBtn.setAttribute('aria-label', 'Mute');
    }
}

function updatePlaybackSpeedUI(speed) {
    // Check if speed control elements exist
    if (!speedDisplay || !speedOptionsList) return;

    speedDisplay.textContent = `${speed}x`;
    // Update active state in the speed options list
    speedOptionsList.querySelectorAll('li').forEach(li => {
        // Use tolerance for float comparison
        li.classList.toggle('active', Math.abs(parseFloat(li.dataset.speed) - speed) < 0.01);
    });
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    console.log("Setting up event listeners...");

    // --- Play/Pause ---
    if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlayPause);
    if (overlayPlayButton) overlayPlayButton.addEventListener('click', togglePlayPause);
    // Optional: click video area to toggle play/pause (can sometimes interfere)
    // if (playerContainer) playerContainer.addEventListener('click', (e) => {
    //    if (e.target === playerContainer || e.target === overlayPlayButton || e.target.closest('#youtube-player')) {
    //       togglePlayPause();
    //     }
    // });

    // --- Seek Bar ---
    if (seekBar) {
        seekBar.addEventListener('input', handleSeekInput); // Update time display while scrubbing
        seekBar.addEventListener('change', handleSeekChange); // Seek when scrubbing finishes
    }

    // --- Volume ---
    if (volumeBtn) volumeBtn.addEventListener('click', toggleMute);
    if (volumeSlider) volumeSlider.addEventListener('input', handleVolumeChange);

    // --- Speed --- (Only add listeners if elements exist)
    if (speedBtn && speedOptionsList) {
        speedBtn.addEventListener('click', () => {
            speedOptionsList.classList.toggle('hidden');
        });
        speedOptionsList.addEventListener('click', handleSpeedChange);
        // Hide speed options if clicking elsewhere
        document.addEventListener('click', (event) => {
            if (!speedBtn.contains(event.target) && !speedOptionsList.contains(event.target)) {
                speedOptionsList.classList.add('hidden');
            }
        });
    }

    // --- Fullscreen ---
    if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);
    // Listen for fullscreen changes on the document
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange); // Safari
    document.addEventListener('mozfullscreenchange', handleFullscreenChange); // Firefox
    document.addEventListener('MSFullscreenChange', handleFullscreenChange); // IE/Edge

    // --- Tab Switching Logic ---
    if (tabButtons.length > 0 && tabContents.length > 0) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTabId = button.dataset.target; // e.g., "study-material-content"
                 if (!targetTabId) {
                     console.warn("Tab button missing data-target attribute:", button);
                     return;
                 }
                const targetTabContent = document.getElementById(targetTabId);

                console.log(`Tab clicked: Target ID = ${targetTabId}`); // Debug log

                // Deactivate all buttons and hide all content first
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                // Activate the clicked button and show the corresponding content
                button.classList.add('active');
                if (targetTabContent) {
                    targetTabContent.classList.add('active');
                    console.log(`Activated content:`, targetTabContent); // Debug log
                } else {
                    console.warn(`Tab content element with ID '${targetTabId}' not found.`);
                }
            });
        });
    } else {
        console.warn("Tab buttons or content elements not found, tab switching disabled.");
    }


    // --- Timeline Click-to-Seek Logic ---
    if (timelineList) {
        timelineList.addEventListener('click', handleTimelineItemClick);
        timelineList.addEventListener('keydown', handleTimelineItemKeydown); // For accessibility
    } else {
        console.warn("Timeline list container (#timeline-list) not found. Timeline seeking disabled.");
    }

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
        // Show controls on mouse move over the entire player wrapper
        playerWrapper.addEventListener('mousemove', showControls);
        // Keep controls visible when mouse is directly over them
        controlsContainer.addEventListener('mouseenter', showControls);
        // Restart hide timer when mouse leaves controls (but is still over wrapper)
        controlsContainer.addEventListener('mouseleave', hideControlsAfterTimeout);
         // Also show on focus events within the wrapper (accessibility)
         playerWrapper.addEventListener('focusin', showControls);
         playerWrapper.addEventListener('focusout', hideControlsAfterTimeout);

        // Initial setup: show controls briefly then start hide timer
        showControls();
        hideControlsAfterTimeout();
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
        if (timelineItem) {
            event.preventDefault(); // Prevent page scroll on spacebar
            seekToTimelineItem(timelineItem);
        }
    }
}

function seekToTimelineItem(timelineItem) {
    if (timelineItem && timelineItem.dataset.time !== undefined) {
        const time = parseFloat(timelineItem.dataset.time);
        if (!isNaN(time) && player && typeof player.seekTo === 'function') {
            console.log(`Timeline Seek: Requesting seek to ${time}s`);
            player.seekTo(time, true); // Seek and allow play
            // Ensure playing after seek
            if (player.getPlayerState() !== YT.PlayerState.PLAYING) {
                player.playVideo();
            }
        } else {
             console.warn("Timeline seek failed: Invalid time or player not ready.", { time: timelineItem.dataset.time, playerExists: !!player });
        }
    }
}


// --- Control Action Handlers ---
function togglePlayPause() {
    if (!player || typeof player.getPlayerState !== 'function') return;
    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING) {
        player.pauseVideo();
    } else {
        player.playVideo();
    }
}

function handleSeekInput(event) {
     if (!player || typeof player.getDuration !== 'function' || !timeDisplay) return;
     const duration = player.getDuration();
     if (!isNaN(duration) && duration > 0) {
        // Update time display instantly while scrubbing
        timeDisplay.textContent = `${formatTime(event.target.value)} / ${formatTime(duration)}`;
     }
     // Optional: Update progress bar visually during scrubbing for instant feedback
     if (progressBar) progressBar.value = event.target.value;
}

function handleSeekChange(event) {
    if (!player || typeof player.seekTo !== 'function') return;
    const time = parseFloat(event.target.value);
    if (!isNaN(time)) {
        console.log(`Seek Bar Change: Requesting seek to ${time}`);
        player.seekTo(time, true); // Seek and allow playing if paused
        // No need to explicitly play here, seekTo(time, true) should handle it if needed.
    }
     // Update the progress bar value definitively after seeking
     if (progressBar) progressBar.value = time;
}

function toggleMute() {
    if (!player || typeof player.isMuted !== 'function') return;
    if (player.isMuted()) {
        player.unMute();
    } else {
        player.mute();
    }
    // UI update will happen via state change or direct call is fine too
     updateVolumeUI(player.getVolume(), player.isMuted());
}

function handleVolumeChange(event) {
    if (!player || typeof player.setVolume !== 'function') return;
    const volume = parseInt(event.target.value, 10);
    if (player.isMuted() && volume > 0) {
        player.unMute(); // Unmute if user adjusts volume slider while muted
    }
    player.setVolume(volume);
    updateVolumeUI(volume, player.isMuted()); // Update UI immediately
}

function handleSpeedChange(event) {
    // Check if the clicked element is a list item with a data-speed attribute
    const targetLi = event.target.closest('li[data-speed]');
    if (targetLi && player && typeof player.setPlaybackRate === 'function' && speedOptionsList) {
        const speed = parseFloat(targetLi.dataset.speed);
         if (!isNaN(speed)) {
             player.setPlaybackRate(speed);
             updatePlaybackSpeedUI(speed); // Update display and active class
             speedOptionsList.classList.add('hidden'); // Hide options after selection
             console.log(`Playback speed set to: ${speed}x`);
         }
    }
}

function toggleFullscreen() {
     if (!playerWrapper) return; // Need the wrapper element
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
         // Enter fullscreen mode
        console.log("Entering fullscreen");
        if (playerWrapper.requestFullscreen) {
            playerWrapper.requestFullscreen();
        } else if (playerWrapper.webkitRequestFullscreen) { /* Safari */
            playerWrapper.webkitRequestFullscreen();
        } else if (playerWrapper.mozRequestFullScreen) { /* Firefox */
            playerWrapper.mozRequestFullScreen();
        } else if (playerWrapper.msRequestFullscreen) { /* IE/Edge */
            playerWrapper.msRequestFullscreen();
        } else {
             console.error("Fullscreen API is not supported by this browser.");
        }
    } else {
        // Exit fullscreen mode
        console.log("Exiting fullscreen");
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { /* Safari */
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) { /* Firefox */
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) { /* IE/Edge */
            document.msExitFullscreen();
        }
    }
}

function handleFullscreenChange() {
    if (!fullscreenBtn || !playerWrapper) return;
    const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    const icon = fullscreenBtn.querySelector('i');

    if (isFullscreen) {
        console.log("Browser entered fullscreen mode.");
        if(icon) {
             icon.classList.remove('fa-expand');
             icon.classList.add('fa-compress');
        }
        playerWrapper.classList.add('fullscreen-active'); // Add a class for styling
        fullscreenBtn.setAttribute('aria-label', 'Exit Fullscreen');
    } else {
        console.log("Browser exited fullscreen mode.");
        if(icon) {
            icon.classList.remove('fa-compress');
            icon.classList.add('fa-expand');
        }
        playerWrapper.classList.remove('fullscreen-active'); // Remove styling class
        fullscreenBtn.setAttribute('aria-label', 'Enter Fullscreen');
    }
}

// --- Controls Visibility Handlers ---
function showControls() {
    if (!controlsContainer || !playerWrapper) return;
    clearTimeout(controlsTimeout); // Clear any pending hide timer
    controlsContainer.classList.remove('hidden');
    controlsContainer.style.opacity = '1'; // Make sure it's visible
    playerWrapper.style.cursor = ''; // Show default cursor
}

function hideControlsAfterTimeout() {
     if (!controlsContainer || !playerWrapper) return;
    clearTimeout(controlsTimeout); // Clear previous timer
    // Only start hiding if the video is playing and the mouse isn't over the controls
    if (player && player.getPlayerState() === YT.PlayerState.PLAYING && !controlsContainer.matches(':hover')) {
        controlsTimeout = setTimeout(() => {
            controlsContainer.classList.add('hidden');
             controlsContainer.style.opacity = '0'; // Use opacity for smooth transition if CSS supports it
            playerWrapper.style.cursor = 'none'; // Hide cursor
        }, 3000); // Hide after 3 seconds of inactivity
    }
}


// --- Optional Rating Star Handlers ---
let currentRating = 0; // Store the currently selected rating
function handleStarHover(event) {
    if (!event.target.dataset.value) return;
    const hoverValue = parseInt(event.target.dataset.value, 10);
    ratingStars.forEach((star, index) => {
        // Add 'hover' class up to the hovered star
        star.classList.toggle('hover', index < hoverValue);
        // Temporarily make them solid font awesome stars on hover
         star.classList.toggle('fas', index < hoverValue); // Use solid star
         star.classList.toggle('far', index >= hoverValue); // Use regular star
    });
}

function handleStarMouseOut() {
    // Reset stars based on the actual currentRating, remove all hover effects
    ratingStars.forEach((star, index) => {
        star.classList.remove('hover'); // Remove hover highlight
        star.classList.toggle('selected', index < currentRating); // Apply 'selected' class based on actual rating
        // Reset icon style based on 'selected' state
        star.classList.toggle('fas', index < currentRating); // Solid if selected
        star.classList.toggle('far', index >= currentRating); // Regular if not selected
    });
}

function handleStarClick(event) {
    if (!event.target.dataset.value || !ratingFeedback) return;
    currentRating = parseInt(event.target.dataset.value, 10);
    ratingStars.forEach((star, index) => {
        star.classList.toggle('selected', index < currentRating); // Set selected state
        star.classList.remove('hover'); // Clean up hover state
         // Ensure correct icon style after click
         star.classList.toggle('fas', index < currentRating);
         star.classList.toggle('far', index >= currentRating);
    });
    // Display feedback message
    ratingFeedback.textContent = `Thank you for rating ${currentRating} out of 5!`;
     ratingFeedback.classList.remove('hidden');
    console.log(`Rating submitted: ${currentRating}`);
    // TODO: Send the rating to your backend server here if needed
}


// --- Initial Check ---
// The YouTube API loads asynchronously. The global `onYouTubeIframeAPIReady` function
// in player.html handles calling `initializePlayer` when the API is ready.
// No immediate call to initializePlayer here is needed.
console.log("player.js loaded. Waiting for onYouTubeIframeAPIReady...");