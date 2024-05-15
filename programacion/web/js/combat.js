/* eslint-disable no-unused-vars */
function dragStart (event) {
  event.dataTransfer.setData('text', event.target.id)
  console.log(event.target.id)
}

function drop (event) {
  event.preventDefault()
  const data = event.dataTransfer.getData('text')
  console.log(data)
  const user = localStorage.getItem('username')

  fetch('/playCard', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id: data, user })
  })
    .then(response => response.json())
    .then(data => {
      if (data.message) {
        console.log(data.message)
      } else {
        console.log(data)
      }
    })
    .catch(error => {
      console.error('Error:', error)
    })
}

function dragOver (event) {
  event.preventDefault()
}
