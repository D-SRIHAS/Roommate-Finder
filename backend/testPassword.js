const bcrypt = require("bcryptjs");

const enteredPassword = "password123";  // Same password used during login
const storedHash = "$2b$10$8A7HvBcT3UsNheWmJGmdjuhaKJkvGkDEUQ/Axrka6j/7ZOFIb18dy"; // Your stored password from MongoDB

bcrypt.compare(enteredPassword, storedHash, (err, result) => {
  if (err) {
    console.error("Error comparing passwords:", err);
  } else {
    console.log("Password match result:", result);
  }
});
