#!/usr/bin/node

// ssh -L 8585:192.168.65.131:8585 root@192.168.65.131
// alias bl='balance -df 8585 127.0.0.1:5858 > /tmp/balance.out 2>&1 &'

var exec = require('child_process').exec;
var RX = require('rxjs');

var child = exec('java -jar rfid-movement-detection-0.1-SNAPSHOT.jar');

var database = {};
var minDistanceMoved = 4;
var stream;
var channel = new RX.Observable.create((obsever) => {
    stream = obsever;
});

var tags = [
    'E2004084390501750400EA3F',
    '000000000000000000400595',
    'E2004084390501750230F5C1',
    '000000000000000000001120',
    'E200408439050175143085C1',
    '000000000000000013781212',
    'E2004084390501751280950E'
];

for (var i in tags) {
    var tag = tags[i];
    database[tag] = {
        totalSeen: 0,
        distanceAvg: 0,
        distance: 0,
        lastSeen: null
    }
}

channel.throttleTime(5).map(data=> {
    // ignore unknown tags
    console.log(data)
    var tag = data.tag.trim();
    if (!database[tag]) {
        console.log('ignoring unknown tag ' + tag);
        return null;
    }

    var newDistance = Math.abs(data.distance)
    var oldDistance = Math.abs(database[tag].distance)
    var differenceInDistance = Math.abs(newDistance - oldDistance);
    if (oldDistance != 0 &&
        differenceInDistance > minDistanceMoved) {
        console.log(`Sample id moved ' ${tag} old: ${oldDistance} new: ${newDistance}`);
    }
    database[tag].distance = data.distance;
    database[tag].totalSeen = database[tag].totalSeen + 1;
    //console.log(database)
    return data;
}).subscribe(e=> {
    //console.log(database);
});

child.stdout.on('data', function (data) {
    var re = 'rssi\ (.*)(, epc)(.*), count\ ([0-9A-Za-z]+)';
    var match = data.match(new RegExp(re));
    if (match == null)
        return;
    var data = {
        distance: match[1] * -1,
        tag: match[3],
        count: match[4]
    };
    if (!stream)
        return;
    stream.next(data);

    //console.log('stdout: ' + data);
});
child.stderr.on('data', function (data) {
    console.log('stdout: ' + data);
});
child.on('close', function (code) {
    console.log('closing code: ' + code);
});
