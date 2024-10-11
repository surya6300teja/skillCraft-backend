const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { process } = require('ipaddr.js');

const app = express();


// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));
app.use(express.urlencoded({ extended: true }));
app.use(cors());
dotenv.config();

// Routes
// app.get('/', (req, res) => {
//   res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
// });

app.get('/api', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});

// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '../client/dist', 'index.html'));
// });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'temp/'));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Route for file upload
app.post('/upload-pdf', upload.single('pdfFile'), async (req, res) => {
  console.log("hit");
  if (!req.file) {
    return res.status(400).json({
      message: 'No file uploaded or the file format is incorrect. Please upload a PDF.'
    });
  }
  try {
    const pdfFilePath = req.file.path;
    const dataBuffer = fs.readFileSync(pdfFilePath);
    
    // Parse the PDF
    const data = await pdfParse(dataBuffer);
    const extractedText = data.text;

    // Delete the uploaded file after processing
    fs.unlinkSync(pdfFilePath);

    const apiKey = process.env.GEMINI_KEY;
    if (!apiKey) {
      throw new Error('API key is missing.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Define the prompt
    const prompt = `Take the provided resume data, identify the most relevant job title, and generate a job description based on that title. Compare the skills and experience in the resume against the generated job description. Return the comparison result as a JSON object with three key parameters: recommended_skills (a list of market-trending skills that would significantly improve the candidate's score, with each skill accompanied by an estimated score increase if the user learns it), score (an overall percentage score reflecting how well the resume matches the job description), and total_possible_score (the estimated score if all recommended skills are learned).
    The output should not include any explanation or job description, only the recommended_skills, score, and total_possible_score in JSON format. Resume Data: ${extractedText}`;

    // Send request to Gemini API
    const airesult = await model.generateContent(prompt);
    
    // Clean the response text by removing unwanted characters like backticks and markdown
    let responseText = airesult.response.text();
    
    responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim(); // Remove markdown and extra backticks
    
    // Parse the cleaned response as JSON
    const responseJson = JSON.parse(responseText);
    
    // Extract the score and recommended_skills from the response
    const { recommended_skills, score, total_possible_score } = responseJson;

    // Send the score and recommended_skills as a response
    return res.status(200).json({
      recommended_skills,
      score,
      total_possible_score
    });
  } catch (error) {
    console.error('Error processing the file:', error);
    return res.status(500).json({
      message: 'Error processing the file.',
      error: error.message
    });
  }
});

app.post('/courses', async (req, res) => {
  console.log("hit fc");
  try {
    const receivedList = req.body.list;
    console.log('Received List:', receivedList);

    const apiKey = process.env.GEMINI_KEY;
    if (!apiKey) {
      throw new Error('API key is missing.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Define the prompt
    const prompt = `Given the following list of skills, provide a JSON object containing a list of relevant courses for each skill along with their links. Each entry should include the course name, provider, and URL. Ensure that all links are verified and working. Do not include any additional explanations or information. List of skills: ${receivedList}`;

    // Send request to Gemini API
    const coursesresult = await model.generateContent(prompt);
    
    // Clean the response text by removing unwanted characters like backticks and markdown
    let responseCourses = coursesresult.response.text();
    
    responseCourses = responseCourses.replace(/```json/g, '').replace(/```/g, '').trim(); // Remove markdown and extra backticks
    
    // Parse the cleaned response as JSON
    const responseCoursesJson = JSON.parse(responseCourses);
    console.log(responseCoursesJson);

    res.status(200).json({ Courses: responseCoursesJson });
  } catch (error) {
    console.error('Error processing the request:', error);
    return res.status(500).json({
      message: 'Error processing the request.',
      error: error.message
    });
  }
});

// Start the server
module.exports = app;
