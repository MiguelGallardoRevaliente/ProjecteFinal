/* eslint-disable no-unused-vars */
function dragStart (event) {
  event.dataTransfer.setData('text', event.target.id)
  event.dataTransfer.setData('src', event.target.src)
  console.log(event.target.src)
}

function drop (event) {
  event.preventDefault()
  const src = event.dataTransfer.getData('src')
  console.log(src)
}

function dragOver (event) {
  event.preventDefault()
}
