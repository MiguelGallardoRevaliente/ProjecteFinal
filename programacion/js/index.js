import express from 'express'

const app = express()
app.disable('x-powered-by')

const PORT = process.env.PORT ?? 1234

app.get('/', (req, res) => {
  res.send('Hello, world!')
})

app.post('/', (req, res) => {
  console.log(req.body)
})

app.listen(PORT, () => {
  console.log('server listening on port http://localhost:' + PORT)
})
