import { createTransport } from 'nodemailer'

// email sender function
export function sendEmail (req, res) {
  // Definimos el transporter
  const transporter = createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Use `true` for port 465, `false` for all other ports
    auth: {
      user: 'cardgame.chamous@gmail.com',
      pass: 'atmn rjec ahhu kvzf'
    }
  })

  // Definimos el email
  const mailOptions = {
    from: 'cardgame.chamous@gmail.com',
    to: req.to,
    subject: req.subject,
    text: req.text
  }

  // Enviamos el email
  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error)
      res.send(500, error.message)
    } else {
      console.log('Email sent')
      res.status(200).jsonp(req.body)
    }
  })
}
