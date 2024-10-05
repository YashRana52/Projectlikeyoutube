
import mongoose, { Schema } from "mongoose";

const subscriptionSchema = new Schema({
    subscriber:{
        type:Schema.Types.ObjectId, // one who subscribe in
        ref:"User"
    },
   channel:{
        type:Schema.Types.ObjectId, // one who subscriber is suscribing
        ref:"User"
    }

},{timestamps:true})
 export const Subscription = mongoose.model("Subscription",subscriptionSchema)