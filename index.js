const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 8000
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const corsOptions = {
    origin: ['http://localhost:5173'],
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.dnxxphb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
})

async function run() {
    try {

        const petsCollection = client.db("petzAdopt").collection("pets");
        const campaignCollection = client.db("petzAdopt").collection("donationCampaigns");
    

       

        //pets
        app.get('/all-pets', verifyToken, async (req, res) => {
            const result = await petsCollection.find().toArray();
            res.send(result);
        });

        app.get('/pets', async (req, res) => {
            const category = req.query?.category;
            let name = req.query?.name;
            let query = { adopted: false };
            const offset = parseInt(req.query?.offset) || 0;
            const limit = parseInt(req.query?.limit) || 6;
            if (name) {
                name = new RegExp(name, 'i');
                query = { ...query, petName: name };
            }
            if (category) {
                query = { ...query, category: category };
            }
            // console.log(query)
            const options = {
                sort: { addedTime: -1 },
            };

            const result = await petsCollection.find(query, options)
                .skip(offset)
                .limit(limit)
                .toArray();
            res.send(result);
        });


        app.get('/pets/:id', async (req, res) => {
            const petId = req?.params?.id;
            // console.log(petId)
            const query = { _id: new ObjectId(petId) };
            const result = await petsCollection.findOne(query);
            res.send(result)
        })

        app.get('/pets-added/:email', verifyToken, async (req, res) => {
            const email = req?.params?.email;
            const query = { adderEmail: email };
            const result = await petsCollection.find(query).toArray();
            res.send(result)
        })
        //pet adding
        app.post('/pets', verifyToken, async (req, res) => {
            const item = req.body;
            const result = await petsCollection.insertOne(item);
            res.send(result);
        });
        //pet updating
        app.put('/pets/update/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const updatedDetails = req.body;

            try {
                const filter = { _id: new ObjectId(id) };
                const updateDoc = { $set: updatedDetails };

                const result = await petsCollection.updateOne(filter, updateDoc);
                if (result.modifiedCount === 1) {
                    res.json({ message: 'Pet details updated successfully' });
                } else {
                    res.status(404).json({ message: 'Pet not found or details already updated' });
                }
            } catch (error) {
                console.error('Error updating pet details:', error);
                res.status(500).json({ message: 'An error occurred while updating the pet details' });
            }
        });
        //updating adoption status
        app.patch('/pets/adopt/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const adopt = await petsCollection.findOne(filter);
            const updatedDoc = {
                $set: {
                    adopted: !(adopt?.adopted)
                }
            }
            const result = await petsCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })




        //pet deleting
        app.delete('/pets/delete/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            try {
                const result = await petsCollection.deleteOne({ _id: new ObjectId(id) });
                if (result.deletedCount === 1) {
                    res.json({ message: 'Pet deleted successfully' });
                }
            } catch (error) {
                console.error('Error deleting pet:', error);
                res.status(500).json({ message: 'An error occurred while deleting the pet' });
            }
        });
        
        //Campaigns


        app.get('/campaigns', async (req, res) => {
            const offset = parseInt(req.query?.offset) || 0;
            const limit = parseInt(req.query?.limit);
            const options = {
                sort: { addedTime: -1 },
            };
            const result = await campaignCollection.find({}, options)
                .skip(offset)
                .limit(limit)
                .toArray();
            ;
            res.send(result);
        });
        app.get('/campaigns/:id', async (req, res) => {
            const campaignId = req?.params?.id;
            // console.log(campaignId)
            const query = { _id: new ObjectId(campaignId) };
            const result = await campaignCollection.findOne(query);
            res.send(result)
        })
        app.get('/campaigns/my-added/:email', verifyToken, async (req, res) => {
            const email = req?.params?.email;
            // console.log(campaignId)
            const query = { adderEmail: email };
            const result = await campaignCollection.find(query).toArray();
            res.send(result)
        })
        app.post('/campaign', verifyToken, async (req, res) => {
            const campaign = req.body;
            const result = await campaignCollection.insertOne(campaign);
            res.send(result);
        });

        app.patch('/campaign/pause/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            // console.log(id)
            const filter = { _id: new ObjectId(id) };
            try {
                const campaign = await campaignCollection.findOne(filter);
                if (!campaign) {
                    return res.status(404).send({ error: 'Campaign not found' });
                }
                // console.log(campaign)
                const updatedDoc = {
                    $set: {
                        pause: !campaign.pause
                    }
                };

                const result = await campaignCollection.updateOne(filter, updatedDoc);
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'An error occurred while updating the campaign' });
            }
        })

        //update campaign
        app.put('/campaign/update/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const updatedDetails = req.body;

            try {
                const filter = { _id: new ObjectId(id) };
                const updateDoc = { $set: updatedDetails };

                const result = await campaignCollection.updateOne(filter, updateDoc);
                if (result.modifiedCount === 1) {
                    res.json({ message: 'Campaign details updated successfully' });
                } else {
                    res.status(404).json({ message: 'Campaign not found or details already updated' });
                }
            } catch (error) {
                console.error('Error updating Campaign details:', error);
                res.status(500).json({ message: 'An error occurred while updating the Campaign details' });
            }
        });

        app.get('/recommended-campaigns/:id', async (req, res) => {
            const id = req.params.id;
            const limit = 3; // Number of campaigns to return
            try {
                const query = {
                    _id: { $ne: new ObjectId(id) },
                    pause: false
                };
                const options = {
                    limit: limit
                };
                const recommendedCampaigns = await campaignCollection.find(query, options).toArray();
                res.send(recommendedCampaigns);
            } catch (error) {
                console.error('Error fetching recommended campaigns:', error);
                res.status(500).json({ message: 'An error occurred while fetching recommended campaigns' });
            }
        });


        app.put('/campaign/update', verifyToken, async (req, res) => {
            const payment = req.body;
            const { campaignId, donatedAmount } = payment;
            const amountNumber = parseFloat(donatedAmount);

            const query = {
                _id: new ObjectId(campaignId)
            }
            const campaign = await campaignCollection.findOne(query);
            const donatedAmountNumber = parseFloat(campaign.donatedAmount || 0);
            const newDonatedAmount = amountNumber - donatedAmountNumber;

            const updatedCampaign = await campaignCollection.findOneAndUpdate(
                query,
                { $set: { donatedAmount: newDonatedAmount.toString() } },
                { returnOriginal: false }
            );

            res.send(updatedCampaign.value);


        });

      
        // await client.db('admin').command({ ping: 1 })
        console.log(
            'Pinged your deployment. You successfully connected to MongoDB!'
        )
    } finally {
        // Ensures that the client will close when you finish/error
    }
}
run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Hello from PetzAdopt Server..')
})

app.listen(port, () => {
    console.log(`PetzAdopt is running on port ${port}`)
})
