const BACKEND_URL = "https://shul-backend.onrender.com"; 

async function displaySchedule() {
    const scheduleList = document.getElementById('schedule-list');
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/schedule`);
        const liveData = await response.json();

        scheduleList.innerHTML = ''; 

        liveData.forEach(item => {
            const li = document.createElement('li');
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = item.name;
            
            const timeSpan = document.createElement('span');
            timeSpan.textContent = item.time;
            
            li.appendChild(nameSpan);
            li.appendChild(timeSpan);
            scheduleList.appendChild(li);
        });
    } catch (error) {
        console.error("Connection failed:", error);
        scheduleList.innerHTML = '<li><span>Cannot connect to server.</span><span>Please try again later.</span></li>';
    }
}

// Function to load dummy Zmanim data for now
function loadZmanim() {
    const zmanimText = document.getElementById('zmanim-text');
    // We will eventually pull this from a live API based on Miami's zip code
    zmanimText.textContent = "Alos: 5:21 AM | Netz: 6:45 AM | Chatzos: 1:15 PM | Shkiya: 7:42 PM";
}

window.onload = () => {
    displaySchedule();
    loadZmanim();
};
