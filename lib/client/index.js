
function start (config) {
  return new Promise(function (resolve, reject) {
    resolve({speak: speak})
  })
}

function speak (message) {

}

module.exports = {start: start}
