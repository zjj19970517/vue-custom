const fs = require('fs')

const getAllTargets = () => {
  return fs.readdirSync('packages').filter(f => {
    if (!fs.statSync(`packages/${f}`).isDirectory()) {
      return false
    }
    return true
  })
}

module.exports = {
  getAllTargets
}
