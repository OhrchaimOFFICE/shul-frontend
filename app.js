// We will update this with your actual Render URL next
const BACKEND_URL = "https://your-render-url-goes-here.onrender.com"; 

function displaySchedule() {
    const scheduleList = document.getElementById('schedule-list');
    
    // Placeholder data to verify the large-print design is working
    const dummyData = [
        { name: "Shacharis", time: "6:55 AM" },
        { name: "Mincha / Maariv", time: "7:30 PM" }
    ];

    scheduleList.innerHTML = ''; 

    dummyData.forEach(item => {
        const li = document.createElement('li');
        
        const nameSpan = document.createElement('span');
        nameSpan.textContent = item.name;
        
        const timeSpan = document.createElement('span');
        timeSpan.textContent = item.time;
        
        li.appendChild(nameSpan);
        li.appendChild(timeSpan);
        scheduleList.appendChild(li);
    });
}

window.onload = displaySchedule;
