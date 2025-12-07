const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

const uri = process.env.ZAP_SHIFT_USER_URL;

const stripe = require('stripe')(process.env.STRIPE_SECRET);

const crypto = require("crypto");

function generateTrackingId() {
    const prefix = "PRCL"; // your brand prefix
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
    const random = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6-char random hex

    return `${prefix}-${date}-${random}`;
}


// # UGIXrD5UKxGO2GBP
// midddleweare
app.use(express.json());
app.use(cors());

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const db = client.db('zap_shift_db');
        const parcelsCollection = db.collection('parcels');
        const paymentCollection = db.collection('payments');

        // parcel api
        app.get('/parcels', async (req, res) => {
            const query = {}
            const { email } = req.query;
            // /parcels?email=''&
            if (email) {
                query.senderEmail = email;
            }


            const cursor = parcelsCollection.find(query).sort({ createAt: -1 });
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/parcels/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await parcelsCollection.findOne(query);
            res.send(result);
        })

        app.post('/parcels', async (req, res) => {
            const parcel = req.body;
            parcel.createAt = new Date();
            const result = await parcelsCollection.insertOne(parcel)
            res.send(result);
        })

        app.delete('/parcels/:id', async (req, res) => {
            const id = req.params.id;

            const query = { _id: new ObjectId(id) }
            const result = await parcelsCollection.deleteOne(query);
            res.send(result);
        })

        // payment related apis
        app.post('/payment-checkout-session', async (req, res) => {
            const paymentInfo = req.body;
            const amount = parseInt(paymentInfo.cost) * 100;
            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: amount,
                            product_data: {
                                name: `Please pay for: ${paymentInfo.parcelName}`
                            }
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                metadata: {
                    parcelId: paymentInfo.parcelId
                },
                customer_email: paymentInfo.senderEmail,
                success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
            })

            res.send({ url: session.url })
        })

        // payment related apis-->old
        app.post('/create-checkout-session', async (req, res) => {
            const paymentInfo = req.body;
            const amount = parseInt(paymentInfo.cost) * 100;
            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            unit_amount: amount,
                            product_data: {
                                name: paymentInfo.parcelName
                            }
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                metadata: {
                    parcelId: paymentInfo.parcelId
                },
                customer_email: paymentInfo.senderEmail,
                success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success`,
                cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
            });

            console.log(session);
            res.send({ url: session.url });
        })

        // app.patch('/payment-success', async(req, res) =>{
        //     const sessionId = req.query.session_id;

        //     const session = await stripe.checkout.sessions.retrieve(sessionId); 
        //     console.log('session retrive', session);
        //     const trackingId = generateTrackingId()

        //     if(session.payment_status === 'paid'){
        //         const id = session.metadata.parcelId;
        //         const query = {_id: new ObjectId(id)};
        //         const update ={
        //             $set:{
        //                 paymentStatus: 'paid',
        //                 trackingId: trackingId
        //             }
        //         }

        //         const result = await parcelsCollection.updateOne(query, update);
        //         res.send(result);

        //         const payment = {
        //             amount : session.amount_total/100,
        //             currency: session.currency,
        //             customerEmail: session.customer_email,
        //             parcelId: session.metadata.parcelId,
        //             parcelName: session.metadata.parcelName,
        //             transactionId: session.payment_intent,
        //             paymentStatus: session.payment_status,
        //             paidAt: new Date(),
        //             trackingId: trackingId
        //         }

        //         if(session.payment_status === 'paid'){
        //             const resultPayment = await paymentCollection.insertOne(payment);

        //             res.send({
        //                 success: true,
        //                 modifyParcel: result,
        //                 trackingId: trackingId,
        //                 transactionId: session.payment_intent,
        //                 paymentInfo: resultPayment
        //             })
        //         }
        //     }


        //     res.send({success: false});
        // })

        // app.patch('/payment-success', async (req, res) => {
        //     const sessionId = req.query.session_id;

        //     const session = await stripe.checkout.sessions.retrieve(sessionId);
        //     console.log("session retrive", session);

        //     if (session.payment_status !== "paid") {
        //         return res.send({ success: false });
        //     }

        //     const trackingId = generateTrackingId();

        //     // update parcel status
        //     const id = session.metadata.parcelId;
        //     const query = { _id: new ObjectId(id) };
        //     const update = {
        //         $set: {
        //             paymentStatus: "paid",
        //         },
        //     };

        //     const modifyParcel = await parcelsCollection.updateOne(query, update);

        //     // save payment info
        //     const payment = {
        //         amount: session.amount_total / 100,
        //         currency: session.currency,
        //         customerEmail: session.customer_email,
        //         parcelId: session.metadata.parcelId,
        //         parcelName: session.metadata.parcelName,
        //         transactionId: session.payment_intent,
        //         paymentStatus: session.payment_status,
        //         paidAt: new Date(),
        //         trackingId: trackingId,
        //     };

        //     const paymentSaved = await paymentCollection.insertOne(payment);

        //     return res.send({
        //         success: true,
        //         modifyParcel,
        //         trackingId,
        //         transactionId: session.payment_intent,
        //         paymentInfo: paymentSaved,
        //     });
        // });

        app.patch('/payment-success', async (req, res) => {
            const sessionId = req.query.session_id;

            const session = await stripe.checkout.sessions.retrieve(sessionId);

            console.log('session retrieve', session)
            const trackingId = generateTrackingId()

            if (session.payment_status === 'paid') {
                const id = session.metadata.parcelId;
                const query = { _id: new ObjectId(id) }
                const update = {
                    $set: {
                        paymentStatus: 'paid',
                        trackingId: trackingId
                    }
                }

                const result = await parcelsCollection.updateOne(query, update);

                const payment = {
                    amount: session.amount_total / 100,
                    currency: session.currency,
                    customerEmail: session.customer_email,
                    parcelId: session.metadata.parcelId,
                    parcelName: session.metadata.parcelName,
                    transactionId: session.payment_intent,
                    paymentStatus: session.payment_status,
                    paidAt: new Date()
                }

                if (session.payment_status === 'paid') {
                    const resultPayment = await paymentCollection.insertOne(payment)

                    res.send({
                        success: true,
                        modifyParcel: result,
                        trackingId: trackingId,
                        transactionId: session.payment_intent,
                        paymentInfo: resultPayment
                    })
                }

            }

            res.send({ success: false })
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Zap shift Envorinment!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
