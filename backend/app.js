const express = require("express")
const path = require('path');
const publicStaticPath = path.join(__dirname, '../public');
const mongoose = require("mongoose");
const temp_path = path.join(__dirname, "../views")

const app = express();
const ejs = require('ejs');
const bodyParser = require("body-parser");
app.set("view engine", 'ejs')
app.set('views', temp_path);
app.use(express.urlencoded({extended: true}));
app.use(express.static(publicStaticPath));
app.use(bodyParser.urlencoded({ extended: true }));
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
app.use(cookieParser());
const JWT_SECRET = 'your_secret_key';
/* mongodb  */
const uri = "mongodb://localhost:27017/cohort";
mongoose.connect(uri).then(()=>{
    console.log("connection successful with database")
}).catch((error)=>{
    console.log(error);
});

const User = require('./models/User'); 

/* const userSchema = new mongoose.Schema({
    fullName: String,
    username: String,
    email: String,
    phone: String,
    password: String,
    gender: String
});

// Create a model based on the schema
const User = mongoose.model('User', userSchema); */

const courseSchema = new mongoose.Schema({
    courseName: String,
    coursePrice: Number,
    courseLink: String,
    startDate: Date,
    courseDetails: String,
    courseImage: String, 
    courseDay: String, 
    courseTime: String,
    syllabus: [
        {
            topic: String,
            subtopics: [String]
        }
    ],
    registeredUsers: [String]
});


const Course = mongoose.model('Course', courseSchema);

/*  mongodb */

/* middleware */
// Middleware to protect routes
function authenticateToken(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        req.user = null; 
        return next();    
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.redirect('/login');
        }
        req.user = user; 
        
        next();
    });
}
function authenticateAdmin(req, res, next) {
    const token = req.cookies.token;

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.redirect('/login');
        }
        if (decoded.email === 'admin@gmail.com') {
            req.user = decoded; 
            next();
        } else {
            return res.redirect('/login'); 
        }
    });
}

function getGoogleDriveFileId(link) {
    const regex = /\/d\/(.*?)(\/|$)/;
    const match = link.match(regex);
    return match ? match[1] : null; 
}

/* middleware */



/* rendering the pages */

app.get("/",authenticateToken , (req, res)=>{
    const username = req.user ? req.user.username : null;
    res.render("index", { username: username })
})

app.get('/login', (req, res)=>{
    res.render("login");
})
app.get('/signin', (req, res)=>{
    res.render("signin");
})
app.get('/addcourse', authenticateToken , (req, res)=>{
    const username = req.user ? req.user.username : null;
    const useremail = req.user ? req.user.email : null;
    if (useremail === 'admin@gmail.com'){
        res.render("addcourse",{ username: username });
    } else{
        res.status(500).send('You are a idiot mate');
    }
})
app.get('/courses',authenticateToken, async (req, res) => {
    const username = req.user ? req.user.username : null;
    const useremail = req.user ? req.user.email : null;
    try {
        const courses = await Course.find();
        res.render('courses', { courses:courses, username: username, useremail:useremail }); 
    } catch (err) {
        console.error('Error fetching courses:', err);
        res.status(500).send('Error fetching courses');
    }
});

// Route to fetch a single course by ID
app.get('/courses/:id', authenticateToken, async (req, res) => {
    const username = req.user ? req.user.username : null;
    const useremail = req.user ? req.user.email : null;
    try {
        const course = await Course.findById(req.params.id);
        if (!course) {
            return res.status(404).send('Course not found');
        }

        res.render('courseDetails', { course: course, username: username, useremail: useremail });
    } catch (err) {
        console.error('Error fetching course:', err);
        res.status(500).send('Error fetching course');
    }
});

/* rendering the pages */

/* handling post requests */

app.post('/signin', async (req, res)=>{
    console.log("in signin post")
    const newUser = new User({
        fullName: req.body.fullName,
        username: req.body.username,
        email: req.body.email,
        phone: req.body.phone,
        password: req.body.password,  
        gender: req.body.gender
    });
    

    
    await newUser.save().then(obj => {
        console.log('User registered successfully')})
        .catch(err => {
        console.log('Error occurred while saving the user')})
        
    
    res.redirect('/login')
})


app.post('/login', async (req, res) => {
    try {
        console.log(req.body)
        const { username, password } = req.body;

        // Find the user by username (or email/phone)
        const user = await User.findOne({ email:username });
        if (!user ) {
            return res.status(401).send("Authentication failed");
        }
        if (!(await user.comparePassword(password))) {
            return res.status(401).send("Authentication password failed");
        }
        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, username: user.username, email:user.email },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Set the token in cookies
        res.cookie('token', token, { httpOnly: true });
        res.redirect('/'); // Redirect to home or dashboard
    } catch (err) {
        res.status(400).send("Login failed" + err);
    }
});

app.post('/submit-course', async (req, res) => {
    const { courseName, coursePrice, courseLink, startDate, courseDetails, courseImage,courseDay, courseTime, syllabus } = req.body;

    console.log(courseImage)
    const newCourse = new Course({
        courseName,
        coursePrice,
        courseLink,
        startDate,
        courseDetails,
        courseImage: getGoogleDriveFileId(courseImage),
        courseDay, 
        courseTime,
        syllabus,
        registeredUsers: []
    });
    
    console.log(newCourse)
    
    await newCourse.save()
        .then(() => {
            console.log('Course saved to the database');
            res.redirect("/")
        })
        .catch((err) => {
            console.error('Error saving course to the database:', err);
            res.status(500).send('Failed to save course data to the database');
        });
});


app.post('/courses/:id/add-user', async (req, res) => {
    const { id } = req.params;  // Course ID
    const { email } = req.body; // User's email from the request body

    try {
        // Find the course by its ID
        const course = await Course.findById(id);
        if (!course) {
            return res.status(404).send('Course not found');
        }

        // Check if the user is already registered for the course
        if (course.registeredUsers.includes(email)) {
            return res.status(400).send('User already registered');
        }

        // Add the user's email to the course's registeredUsers array
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).send('User not found');
        }
        course.registeredUsers.push(email);
        await course.save();

        // Find the user by their email

        // Check if the course ID is already in the user's registeredCourses array
        if (!user.registeredCourses.includes(id)) {
            // Add the course ID to the user's registeredCourses array
            user.registeredCourses.push(id);
            await user.save();  // Save the updated user document
        }

        // Redirect to the course details page or send a success response
        res.redirect(`/courses/${id}`);
    } catch (error) {
        console.error('Server error:', error);
        res.status(500).send('Server error');
    }
});


app.post('/courses/:id/edit', async (req, res) => {
    const { courseName, coursePrice, courseLink, courseImage, startDate, courseDetails, courseDay, courseTime, syllabus } = req.body;

    try {
        const course = await Course.findById(req.params.id);

        if (!course) {
            return res.status(404).send("Course not found");
        }

        course.courseName = courseName;
        course.coursePrice = coursePrice;
        course.courseLink = courseLink;
        course.courseImage = getGoogleDriveFileId(courseImage);
        course.startDate = startDate;
        course.courseDetails = courseDetails;
        course.courseDay = courseDay;
        course.courseTime = courseTime;
        course.syllabus = syllabus;

        await course.save();

        res.redirect(`/courses/${course._id}`);
    } catch (err) {
        res.status(500).send("Error updating course");
    }
});

/* handling post requests */

/* listening to the port here */
app.listen(process.env.PORT || 8000, ()=>{
    console.log("app started listening at port 8000")
})
/* listening to the port here */