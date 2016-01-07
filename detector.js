#!/usr/bin/node

// ssh -L 8585:192.168.65.131:8585 root@192.168.65.131
// alias bl='balance -df 8585 127.0.0.1:5858 > /tmp/balance.out 2>&1 &'

var exec = require('child_process').exec;
var Rx = require('rxjs');

var child = exec('java -jar rfid-movement-detection-0.1-SNAPSHOT.jar');

var database = {};
var minDistanceMoved = 14;
var inputLiveTags;

var tags = [
    '000000000000001362006243',
    '000000000000000013781212'
];

// build db
for (var i in tags) {
    var tag = tags[i];
    database[tag] = {
        id: tag,
        totalSeen: 0,
        newDistance: 0,
        oldDistance: 0,
        lastSeen: null
    }
}

var source1 = Rx.Observable.create(function (observer) {

    child.stdout.on('data', function (stdout) {
        var re = 'rssi\ (.*)(, epc)(.*), count\ ([0-9A-Za-z]+)';
        var match = stdout.match(new RegExp(re));

        if (match == null)
            return;

        var data = {
            distance: match[1] * -1,
            tag: match[3],
            count: match[4]

        };
        observer.next(data);
    });

    child.stderr.on('data', function (data) {
        //console.log('stdout: ' + data);
    });

    child.on('close', function (code) {
        //console.log('closing code: ' + code);
    });


}).throttleTime(250).map(data=> {

    // ignore unknown tags
    var tag = data.tag.trim();
    if (!database[tag]) {
        console.log('ignoring unknown tag ' + tag);
        return null;
    }

    // fill with latest values off the wire
    database[tag].oldDistance = database[tag].newDistance;
    database[tag].newDistance = data.distance;
    database[tag].totalSeen = database[tag].totalSeen + 1;
    database[tag].lastSeen = new Date();

    return database[tag];
});

var source2 = Rx.Observable.interval(1000).map(e=> {
    return Rx.Observable.create(function (observer) {
        for (var tag in database) {
            observer.next(database[tag]);
        }
    });
}).flatMap(e=> {
    return e
});


var final = Rx.Observable.merge(source1, source2).distinctUntilChanged();
final.subscribe(
    function (x) {
        console.log(`'data ${JSON.stringify(x)}`);
    },
    function (err) {
        console.log('Error: ' + err);
    },
    function () {
        console.log('Completed');
    });

