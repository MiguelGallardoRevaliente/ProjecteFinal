/* eslint-disable no-unused-vars */
function editPassword () {
  const id = document.getElementById('id').value
  fetch('/password/' + id, {
    method: 'GET'
  })
    .then(response => response.text())
    .then(data => {
      const changePasswordDiv = document.getElementsByClassName('changePassword')[0]
      changePasswordDiv.innerHTML = ''

      const passwordInput = document.createElement('input')
      passwordInput.setAttribute('type', 'password')
      passwordInput.className = 'password_input'
      passwordInput.name = 'password'
      passwordInput.value = data

      const saveButton = document.createElement('button')
      saveButton.className = 'save_button'
      saveButton.innerHTML = "<i class='bx bx-check'></i>"
      saveButton.setAttribute('onclick', 'savePassword()')

      const cancelButton = document.createElement('button')
      cancelButton.className = 'cancel_button'
      cancelButton.innerHTML = "<i class='bx bx-x'></i>"
      cancelButton.setAttribute('onclick', 'cancelPassword()')

      changePasswordDiv.appendChild(passwordInput)
      changePasswordDiv.appendChild(saveButton)
      changePasswordDiv.appendChild(cancelButton)
    })
}
