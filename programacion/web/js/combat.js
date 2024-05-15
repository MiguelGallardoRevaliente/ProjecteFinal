/* eslint-disable no-unused-vars */
function drop (event) {
  event.preventDefault()
  const data = event.dataTransfer.getData('text')
  console.log(data)
}

function allowDrop (event) {
  event.preventDefault()
}

function drag (event) {
  event.dataTransfer.setData('text', event.target.src)
}
