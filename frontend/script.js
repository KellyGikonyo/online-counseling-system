// chatbot.js
window.onload = function () {
    const chat = document.createElement('div');
    chat.innerHTML = `<style>
        #chatbot {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #0077cc;
            color: white;
            padding: 15px;
            border-radius: 10px;
            cursor: pointer;
            z-index: 1000;
        }
    </style>
    <div id="chatbot">Chat with us</div>`;
    document.body.appendChild(chat);
    document.getElementById('chatbot').addEventListener('click', function() {
        alert("Hi! I'm your virtual counselor. How can I help you today?");
    });
};

// In counselor-login.html after sucessful login:
localStorage.setItem("userRole", "counselor");
window.location.href="counselor-dashboard.html";

// In admin-login.html after successful login:
localStorage.setItem("userRole", "admin");
window.location.href="admin-dashboard.html";

fetch('http://localhost:3000/login', {
    method: 'POST', // <--- This sets the method to POST
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
})
.then(res => res.json())
.then(data => console.log(data));

document.getElementById('registerForm').onsubmit = function(e) {
  e.preventDefault();
  const data = {
    name: document.getElementById('name').value,
    email: document.getElementById('email').value,
    username: document.getElementById('username').value,
    password: document.getElementById('password').value,
    role: document.getElementById('role').value
  };
  // ...fetch code...
};

fetch('http://localhost:3000/feedback')
    .then(res => res.json())
    .then(feedbacks => {
        document.getElementById('feedbackTable').innerHTML = feedbacks.map(f =>
            `<tr>
                <td>${f.fromUser}</td>
                <td>${f.toUser}</td>
                <td>${f.rating}</td>
                <td>${f.comment}</td>
            </tr>`
        ).join('');
    });

fetch('http://localhost:3000/students', {
    headers: {
        'Authorization': 'Bearer ' + localStorage.getItem('token')
    }
})
.then(res => res.json())
.then(students => {
    // ...handle students...
});
