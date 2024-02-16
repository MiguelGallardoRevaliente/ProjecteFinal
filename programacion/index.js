import express from 'express'
import cors from 'cors'
import path from 'path'

const app = express()
app.use(express.json())
app.use(cors())
app.disable('x-powered-by')

app.get('/', (req, res) => {
  res.header('Allow-Control-Allow-Origin', '*')
  res.send('Paleto')
})

app.post('/', (req, res) => {
  console.log(req.body)
})

const PORT = process.env.PORT ?? 1234

app.use(express.static(path.join('./web/index.html', 'public')))

app.listen(PORT, () => {
  console.log('server listening on port http://localhost:' + PORT)
})
