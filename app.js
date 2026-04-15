// Connected to your live Render backend
const BACKEND_URL = "https://shul-backend.onrender.com"; 

async function displaySchedule() {
    const scheduleList = document.getElementById('schedule-list');
    
    try {
        // This actually "calls" your Render server over the internet
        const response = await fetch(`${BACKEND_URL}/api/schedule`);
        const liveData = await response.json();

        scheduleList.innerHTML = ''; // Clears the "Connecting..." text

        // Loops through the data sent by Render and creates the large text boxes
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

window.onload = displaySchedule;
