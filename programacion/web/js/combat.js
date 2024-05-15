/* eslint-disable no-unused-vars */
function dragStart (event) {
  event.dataTransfer.setData('text', event.target.id)
  console.log(event.target.id)
}

function drop (event) {
  event.preventDefault()
  const data = event.dataTransfer.getData('text')
  console.log(data)
}

function dragOver (event) {
  event.preventDefault()
}
