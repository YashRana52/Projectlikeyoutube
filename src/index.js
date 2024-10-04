import dotenv from 'dotenv';
import { app } from './app.js';
import connectDB from './db/index.js';

// Load environment variables from the specified path
dotenv.config({ path: './env' });

// Connect to the database
connectDB()
  .then(() => {
    // Start the server after successful database connection
    const PORT = process.env.PORT || 8000;
    app.listen(PORT, () => {
      console.log(`⚙️  Server is running at port: ${PORT}`);
    });
  })
  .catch((err) => {
    // Handle database connection errors
    console.error("MONGO DB connection failed!!!", err);
  });


//  import express from "express";
//  const app = express()

//  (async ()=>{
//     try {
//        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
//        app.on("error",(error)=>{
//         console.log("ERROR:",error);
//         throw error

//        })
//        app.listen(process.env.PORT,()=>{
//         console.log(`App is listening on port${process.env.PORT}`);

//        })

//     } catch (error) {
//         console.log('ERROR',error);
//         throw error

//     }
//  })
