// --- Global Variables ---
let player; // YouTube Player object
let currentVideoData = null; // To store data for the current video
let youtubeId = null; // Store video ID globally within the script scope
let videoTitle = 'Video Player'; // Default title

// --- DOM Elements ---
const videoTitleHeader = document.getElementById('video-title-header');
const studyMaterialList = document.getElementById('study-material-list');
const timelineList = document.getElementById('timeline-list');
const relatedVideosList = document.getElementById('related-videos-list');
const tabsContainer = document.querySelector('.tabs');
const tabPanes = document.querySelectorAll('.tab-pane');
const tabButtons = document.querySelectorAll('.tab-button');
const darkLightToggle = document.getElementById('dark-light-toggle');
const oldPlayerLink = document.getElementById('old-player-link'); // Changed to link
const playerPlaceholder = document.getElementById('youtube-player-placeholder');
const menuIcon = document.getElementById('menu-icon');
const dropdownMenu = document.getElementById('dropdown-menu');
const errorMessageArea = document.getElementById('error-message-area');


// --- Utility Functions ---
function getQueryParams() {
    const params = {};
    const queryString = window.location.search.substring(1);
    const regex = /([^&=]+)=([^&]*)/g;
    let m;
    while (m = regex.exec(queryString)) {
        params[decodeURIComponent(m[1])] = decodeURIComponent(m[2].replace(/\+/g, ' ')); // Handle '+' for spaces
    }
    return params;
}

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function showErrorMessage(message, isCritical = false) {
    console.error("Error Display:", message);
    errorMessageArea.textContent = message;
    errorMessageArea.classList.add('show');

    // Clear loading states in tabs when showing an error
    studyMaterialList.innerHTML = '<li>Error loading data.</li>';
    timelineList.innerHTML = '<li>Error loading data.</li>';
    relatedVideosList.innerHTML = '<li>Error loading data.</li>';

    // If it's a critical error (e.g., no video ID), hide the player placeholder too
    if (isCritical && playerPlaceholder) {
        playerPlaceholder.textContent = 'Video cannot be loaded.';
        playerPlaceholder.style.display = 'flex'; // Ensure it's visible
         // Hide the iframe container if it exists
         const playerDiv = document.getElementById('youtube-player');
         if(playerDiv) playerDiv.style.display = 'none';
    }
}

function hideErrorMessage() {
     errorMessageArea.textContent = '';
     errorMessageArea.classList.remove('show');
}

// --- Theme Management ---
function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark-mode', isDark);
    document.body.classList.toggle('light-mode', !isDark);
    darkLightToggle.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    localStorage.setItem('theme', theme);
}

// --- Tab Content Population ---
function populateStudyMaterials(materials) {
    studyMaterialList.innerHTML = ''; // Clear loading/previous
    if (!materials || materials.length === 0) {
        studyMaterialList.innerHTML = '<li>No study materials available.</li>';
        return;
    }
    materials.forEach(item => {
        const li = document.createElement('li');
        const titleSpan = document.createElement('span');
        titleSpan.textContent = item.title;

        const viewLink = document.createElement('a');
        viewLink.href = item.url;
        viewLink.textContent = 'View';
        viewLink.classList.add('view-button');
        if (item.external) {
            viewLink.target = '_blank';
            viewLink.rel = 'noopener noreferrer';
        }

        li.appendChild(titleSpan);
        li.appendChild(viewLink);
        studyMaterialList.appendChild(li);
    });
}

function populateTimeline(timeline) {
    timelineList.innerHTML = ''; // Clear loading/previous
     if (!timeline || timeline.length === 0) {
        timelineList.innerHTML = '<li>No timeline available.</li>';
        return;
    }
    timeline.forEach(item => {
        const li = document.createElement('li');
        li.dataset.time = item.time;

        const timeSpan = document.createElement('span');
        timeSpan.classList.add('time-stamp');
        timeSpan.textContent = formatTime(item.time);

        const titleSpan = document.createElement('span');
        titleSpan.classList.add('time-title');
        titleSpan.textContent = item.title;

        li.appendChild(timeSpan);
        li.appendChild(titleSpan);

        li.addEventListener('click', () => {
            if (player && typeof player.seekTo === 'function') {
                player.seekTo(item.time, true);
                 // Optional highlight removed for simplicity, can be added back
            } else {
                console.warn("Player not ready or seekTo not available.");
            }
        });
        timelineList.appendChild(li);
    });
}

function populateRelatedVideos(related) {
    relatedVideosList.innerHTML = ''; // Clear loading/previous
     if (!related || related.length === 0) {
        relatedVideosList.innerHTML = '<li>No related videos available.</li>';
        return;
    }
    related.forEach(item => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        const title = (item.baseTitle || 'Related_Video').replace(/ /g, '_'); // Ensure title is URL-safe
        link.href = `player.html?youtubeId=${item.youtubeId}&title=${title}`;
        link.textContent = item.title;
        li.appendChild(link);
        relatedVideosList.appendChild(li);
    });
}

function populateTabs(data) {
    populateStudyMaterials(data?.studyMaterials); // Use optional chaining
    populateTimeline(data?.timeline);
    populateRelatedVideos(data?.relatedVideos);
}

// --- Data Fetching ---
async function fetchVideoData() {
    if (!youtubeId) return; // Don't fetch if no ID

    // Clear previous errors before fetching
    hideErrorMessage();
    // Show loading state initially
    studyMaterialList.innerHTML = '<li>Loading...</li>';
    timelineList.innerHTML = '<li>Loading...</li>';
    relatedVideosList.innerHTML = '<li>Loading...</li>';


    try {
        console.log("Fetching data from video_data.json");
        const response = await fetch('video_data.json');
         console.log("Fetch response status:", response.status);
        if (!response.ok) {
            // Be specific about the error
            if(response.status === 404) {
                 throw new Error(`video_data.json not found (404). Make sure it's in the same folder.`);
            } else {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
        }
        const jsonData = await response.json();
        console.log("Successfully parsed Video_data.json");

        currentVideoData = jsonData?.videos?.[youtubeId];

        if (currentVideoData) {
            console.log("Data found for video ID:", youtubeId);
            populateTabs(currentVideoData);
        } else {
            console.warn(`No specific data found in JSON for video ID: ${youtubeId}`);
            showErrorMessage("Additional video data (study materials, etc.) not found for this ID.");
             // Still clear loading states even if specific data isn't found
             populateTabs({}); // Populate with empty data
        }
    } catch (error) {
        console.error('Error fetching or parsing Video_data.json:', error);
        // Show the specific error message caught
        showErrorMessage(`Error loading additional video data: ${error.message}`);
    }
}

// --- YouTube Player API ---
// This function is called automatically by the YouTube IFrame API script
window.onYouTubeIframeAPIReady = function() {
    console.log("YouTube IFrame API Ready.");
    if (youtubeId) {
         console.log("Initializing YouTube player for ID:", youtubeId);
         try {
            playerPlaceholder.style.display = 'none'; // Hide placeholder
            player = new YT.Player('youtube-player', {
                height: '100%', // Let CSS handle sizing
                width: '100%',
                videoId: youtubeId,
                playerVars: {
                    'playsinline': 1, // Good for mobile
                    'autoplay': 0,    // Don't autoplay by default
                    'modestbranding': 1, // Less YouTube branding
                    'rel': 0 // Don't show related videos at the end (we have our own tab)
                },
                events: {
                    'onReady': onPlayerReady,
                    'onError': onPlayerError
                }
            });
            console.log("YT.Player object created (async). Waiting for onReady event.");
        } catch (e) {
             console.error("Error creating YT.Player:", e);
             showErrorMessage("Failed to initialize the YouTube player.", true);
        }

    } else {
        console.error("onYouTubeIframeAPIReady called, but no youtubeId is set.");
        showErrorMessage("Cannot load video: No Video ID provided in the URL.", true);
    }
};

function onPlayerReady(event) {
    // Player is ready to be used
    console.log("Player Ready. State:", event.target.getPlayerState());
     // You could potentially autoplay here if desired:
     // event.target.playVideo();
}

function onPlayerError(event) {
    // Handle player errors (e.g., video unavailable, embedding disabled)
    console.error("YouTube Player Error:", event.data);
    let errorText = "An error occurred with the YouTube player.";
    switch (event.data) {
        case 2: errorText = "Player Error: Invalid video ID."; break;
        case 5: errorText = "Player Error: HTML5 Player issue."; break;
        case 100: errorText = "Player Error: Video not found or private."; break;
        case 101:
        case 150: errorText = "Player Error: Embedding disabled by the video owner."; break;
    }
     showErrorMessage(errorText, true); // Show error, mark as critical
}


// --- Event Listeners ---
function setupEventListeners() {
    // Tab Switching
    tabsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-button')) {
            const targetTab = e.target.dataset.tab;

            tabButtons.forEach(button => button.classList.toggle('active', button.dataset.tab === targetTab));
            tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === targetTab));
        }
    });

    // Dark/Light Mode Toggle
    darkLightToggle.addEventListener('click', () => {
        const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
        dropdownMenu.classList.remove('show'); // Close menu after selection
    });

    // Hamburger Menu Toggle
    menuIcon.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent click from immediately closing menu
        dropdownMenu.classList.toggle('show');
    });

    // Close dropdown if clicking outside
    document.addEventListener('click', (e) => {
        if (!menuIcon.contains(e.target) && !dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.remove('show');
        }
    });

     // Note: Timeline item clicks are handled when items are created in populateTimeline
}

// --- Initialization ---
function initializePage() {
    console.log("Initializing page...");
    // 1. Get URL parameters
    const queryParams = getQueryParams();
    youtubeId = queryParams.youtubeId; // Assign to global variable
    videoTitle = queryParams.title ? queryParams.title.replace(/_/g, ' ') : 'Video Player';

     console.log("Parsed URL Params:", { youtubeId, videoTitle });

    // 2. Update page title and header
    videoTitleHeader.textContent = videoTitle;
    document.title = videoTitle;

    // 3. Set dynamic Old Player link (do this early)
    if (youtubeId) {
        oldPlayerLink.href = `Playerold.html?youtubeId=${youtubeId}`;
         console.log("Set Old Player link href:", oldPlayerLink.href);
    } else {
         oldPlayerLink.href = '#'; // No ID, link is disabled essentially
         oldPlayerLink.style.pointerEvents = 'none'; // Disable clicking
         oldPlayerLink.style.opacity = '0.6';
         console.warn("Old Player link disabled: No youtubeId.");
    }


    // 4. Apply saved theme or default
    const savedTheme = localStorage.getItem('theme') || 'dark';
    applyTheme(savedTheme);
     console.log("Applied theme:", savedTheme);

    // 5. Setup event listeners
    setupEventListeners();
     console.log("Event listeners set up.");

    // 6. Fetch additional video data (happens async)
    fetchVideoData(); // This will run after basic setup

     // 7. The YouTube API will call `onYouTubeIframeAPIReady` automatically
     // Make sure the API script is loaded *before* this script in the HTML.
     console.log("Page initialization complete. Waiting for YouTube API callback...");


     // Add a check if the API ready function doesn't fire after a delay
     setTimeout(() => {
        if (!player && youtubeId && !errorMessageArea.classList.contains('show')) {
            // If player hasn't initialized after a few seconds, and no other error shown
            console.warn("YouTube API ready function may not have fired correctly.");
            // We can't show an error specific to the API not loading easily,
            // but ensure the placeholder reflects the state.
            if (playerPlaceholder.textContent === 'Loading Player...') {
                 playerPlaceholder.textContent = 'Player loading stalled. Check console.';
                 playerPlaceholder.style.display = 'flex';
            }
        }
     }, 5000); // Check after 5 seconds

}

// --- Run Initialization on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', initializePage);