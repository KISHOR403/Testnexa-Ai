require('dotenv').config();
const mongoose = require('mongoose');

console.log('Testing MongoDB connection...');
console.log('URI:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
})
    .then(() => {
        console.log('✅ Success!');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Error details:');
        console.error('Message:', err.message);
        console.error('Name:', err.name);
        console.error('Code:', err.code);
        console.error('Stack:', err.stack);
        process.exit(1);
    });
