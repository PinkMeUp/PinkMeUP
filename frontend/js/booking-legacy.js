
const loginForm = document.querySelector("form");

if (loginForm) {
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const email    = document.querySelector('input[type="email"]').value.trim().toLowerCase();
    const password = document.querySelector('input[type="password"]').value.trim();

  
    if (!email || !password) {
      alert("Please fill in all fields.");
      return;
    }
    if (!email.includes("@")) {
      alert("Enter a valid email address.");
      return;
    }



    
    alert("Invalid email or password. Please try again.");
  });
}


logoutBtn.addEventListener("click", function () {
    localStorage.removeItem('user');
    clearAuthToken(); // from PinkMeUP's auth.js, if using bearer tokens
    window.location.href = "login.html";
});


function guardRoute(...allowedRoles) {
    const user = getCurrentUser(); // from PinkMeUP's auth.js — reads localStorage 'user'
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    if (allowedRoles.length && !allowedRoles.includes(user.role)) {
        alert("Access denied. You do not have permission to view this page.");
        window.location.href = 'login.html';
    }
}


  const user = JSON.parse(raw);
  if (allowedRoles.length && !allowedRoles.includes(user.role)) {
    alert("Access denied. You do not have permission to view this page.");
    sessionStorage.removeItem("currentUser");
    window.location.href = "login.html";
  }
}

  
  sessionStorage.setItem("currentUser", JSON.stringify({
    id:    newCustomer.id,
    role:  newCustomer.role,
    name:  newCustomer.name,
    email: newCustomer.email
  }));

  return { ok: true, user: newCustomer };
}