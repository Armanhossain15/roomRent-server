const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId, Timestamp } = require('mongodb')
const jwt = require('jsonwebtoken')

const port = process.env.PORT || 8000

// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token
  console.log(token)
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}

const uri = `mongodb+srv://stay-vista:wSPUwIUUyiUyVKKM@cluster0.rtlua5u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    const roomsCollection = client.db("stayvista").collection("rooms");
    const userCollection = client.db("stayvista").collection("users");


    // auth related api
    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })
    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
        console.log('Logout successful')
      } catch (err) {
        res.status(500).send(err)
      }
    })

    //user data save on DB
    app.put('/user', async (req, res) => {
      const user = req.body
      const query = { email: user.email }
      //check if user already sign up
      const isExist = await userCollection.findOne(query)
      if (isExist) {
        if (user?.status === 'Requested') {
          const result = await userCollection.updateOne(query, { $set: { status: user?.status } })
          return res.send(result)
        } else return res.send(isExist)
      }
      // new user add to the DB
      const options = { upsert: true }
      const updateDoc = {
        $set: {
          ...user,
          Timestamp: Date.now()
        }
      }
      const result = await userCollection.updateOne(query, updateDoc, options)
      return res.send(result)
    })

    //get all user data
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray()
      return res.send(result)
    })

    //get single user using email
    app.get('/user/:email', async (req, res) => {
      const email = req.params.email
      const result = await userCollection.findOne({ email })
      return res.send(result)
    })

    app.patch('/users/update/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email }
      const updateDoc = {
        $set: {
          ...user,
          Timestamp: Date.now()
        }
      }
      const result = await userCollection.updateOne(query, updateDoc)
      res.send(result)
    })

    //get all room data
    app.get('/rooms', async (req, res) => {
      const category = req.query.category
      // console.log(category);
      let query = {}
      if (category && category !== 'null') {
        query = { category }
      }
      const result = await roomsCollection.find(query).toArray()
      res.send(result)
    })

    //post room data
    app.post('/room', async (req, res) => {
      const roomdata = req.body
      const result = await roomsCollection.insertOne(roomdata)
      res.send(result)
    })

    //get single room Data
    app.get('/room/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await roomsCollection.findOne(query)
      res.send(result)
    })

    //get room Data by email
    app.get('/my-listings/:email', async (req, res) => {
      const email = req.params.email
      let query = { 'host.email': email }
      const result = await roomsCollection.find(query).toArray()
      res.send(result)
    })

    //delete Room
    app.delete('/room/:id', async (req, res) => {
      const id = req.params.id
      let query = { _id: new ObjectId(id) }
      const result = await roomsCollection.deleteOne(query)
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from StayVista Server..')
})

app.listen(port, () => {
  console.log(`StayVista is running on port ${port}`)
})
