
var markov = require('markov')(4)
var Questions = require('irssi-questions')

// only seed with questions, from all the stuff in the seed dir
var fstream = require('fstream')
fstream.Reader({
  path: __dirname + '/seed',
  type: 'Directory'
}).on('child', function (e) {
  if (e.type === 'File') {
    var q = Questions({mark:false})
    e.pipe(q)
    q.on('data', function (s) {
      markov.seed(s)
    })
  }
}).on('close', runBot)
// TODO: Watch the dir for changes, and continue to seed with new data.
// maybe limit it to only being updated every hour or so.


function runBot () {
  console.error('starting bot')
  var irc = require('irc')
  var nick = 'can_i_aks_u_a_q'
  var channels = ['#isaacs']//, '#node.js']
  var client = new irc.Client('irc.freenode.net', nick, {
    channels: channels
  })

  var timers = {}

  function question (message) {
    var resp = markov.respond(message)
    if (resp.length === 0) return question(markov.pick())
    resp = resp.map(function (r) {
      return r.replace(/^[,. ]+|[., ]+$/g, '').trim()
    })
    return resp.join(' ') + '?'
  }

  var lastHi = {}
  client.on('join', function (channel) {
    var lh = lastHi[channel] || 0
    if (Date.now() - lh < 1000*60*60) return
    lastHi[channel] = Date.now()
    client.lastq = question(channel)
    setTimeout(function () {
      client.say(channel, 'Hi.')
      setTimeout(function () {
        client.say(channel,
                   'can I ask a question in here about ' +
                   channel.replace(/^#/, '') + '?')
        client.randomq = setTimeout(function () {
          client.say(channel, question(channel))
        }, 10000)
      }, 3000)
    }, 2000)
  })

  var anyone = {}

  client.on('message', function (from, to, message_) {
    var message = message_
    if (message.indexOf(nick) === -1) return
    message = message.split(nick).join('')
      .replace(/^[:,. ]+|[:., ]+$/g, '').trim()

    if (anyone[to]) {
      clearTimeout(anyone[to])
      anyone[to] = null
    }
    anyone[to] = setTimeout(function () {
      client.say(to, 'anyone?')
      anyone[to] = setTimeout(function () {
        if (Math.random() > 0.5)
          client.say(to, 'can anyone help me with this?')
        else
          client.action('feeling ignored')
        anyone[to] = setTimeout(function () {
          client.part(to)
          anyone[to] = null
          setTimeout(function () {
            client.join(to)
          }, 1000 * 60 * 60 + (1000 * 60 * 60 * Math.random()))
        })
      }, 1000*60*15)
    }, 1000*60*10)
    var w = message.match(/^ask ([^\s]+)/i)
    if (w) {
      return setTimeout(function () {
        client.say(to, w[1] + ': ' + client.lastq)
      }, 400)
    }

    if (timers[from]) {
      clearTimeout(timers[from])
      timers[from] = null
    }
    var rand = Math.random()
    if (rand > 0.9) {
      setTimeout(function () {
        client.say(to, 'Hm.  Ok...')
      }, 1000)
    } else if (rand > 0.85) {
      setTimeout(function () {
        client.say(to, 'But wait, no...  That doesn\'t wrok, does it?')
      }, 2000)
    } else if (rand > 0.6 && !message.match(/\?$/)) {
      return setTimeout(function () {
        client.say(to, from + ': ok, thanks!')
        if (rand > 0.7) setTimeout(function () {
          client.emit('message', from, to, message_)
        }, 1000 * 30)
      }, 2500)
    } else if (rand > 0.2 && !message.match(/\?$/)) {
      return setTimeout(function () {
        var m = question(message)
        client.say(to, from + ': ok, I think I got it.')
        setTimeout(function () {
          client.say(to, from + ': so you\'re saying that ' + m)
        }, 1600)
      }, 500)
    }
    timers[from] = setTimeout(function () {
      client.lastq = question(message)
      client.say(to, from + ': ' + client.lastq)
      timers[from] = null
    }, Math.random() * 3000 + 4000)

    if (client.randomq) {
      clearTimeout(client.randomq)
      client.randomq = null
    }
  })

}
