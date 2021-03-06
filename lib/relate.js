'use strict';
var child_process = require('child_process'),
    promise = require('nodegit-promise'),
    q = require('q'),
    util = require('util'),
    nodegit = require('nodegit');

function RelateCommits(repo) {
    this.repo = repo;
    this.repoPath = repo.path();
}



RelateCommits.relationship = {
    NONE: 0,
    ANCESTOR: 1,
    DESCENDANT: 2,
    EQUAL: 3
};



RelateCommits.prototype.relate = function (commit1, commit2) {
    console.log("Relating : " + commit1 + " and " + commit2);
    var a = this.isAncestor(commit1, commit2);
    var self = this;
    return this.areEqualCommits(commit1, commit2).then(function (are_equal) {
        if (are_equal) {
            return RelateCommits.relationship.EQUAL;
        } else {
            return self.isAncestor(commit1, commit2).then(function (is_ancestor) {
                if (is_ancestor) {
                    return RelateCommits.relationship.ANCESTOR;
                } else {
                    // See if commit2 is an ancestor of commit1
                    return self.isAncestor(commit2, commit1).then(function (is_descendant) {
                        if (is_descendant) {
                            // Commit 2 is an ancestor of commit 1
                            return RelateCommits.relationship.DESCENDANT;
                        } else {
                            return RelateCommits.relationship.NONE;
                        }
                    });
                }
            });
        }
    });
};



RelateCommits.prototype.isAncestor = function (commit1, commit2) {
    var opts = {
        cwd: this.repoPath,
        env: {
            COMMIT1: commit1,
            COMMIT2: commit2
        }
    };

    var cmd = util.format("git merge-base --is-ancestor \"$COMMIT1\" \"$COMMIT2\"");
    var deferred = q.defer();
    child_process.exec(cmd, opts, function(err, stdout, stderr) {
        if (!err) {
            deferred.resolve(true);
        } else if (err && err.code == 1) {
            // is-ancestor exits with an error code of one if commit1 is not the ancestor of commit2
            deferred.resolve(false);
        } else {
            // is-ancestor exits with an error code that is not zero or 1 if there is a problem
            deferred.reject(new Error("Error running git command: " + stderr));
        }
    });
    return deferred.promise;
};



RelateCommits.prototype.areEqualCommits = function (rev1, rev2) {
    var commitPromise1 = this.getCommitForRev(rev1),
        commitPromise2 = this.getCommitForRev(rev2);

    return promise.all([commitPromise1, commitPromise2]).then(function (res) {
        return (res[0].toString() === res[1].toString());
    });
};



RelateCommits.prototype.getCommitForRev = function (rev) {
    var self = this;
    return nodegit.Revparse.single(self.repo, rev).then(function (gitObject) {
        if (gitObject.type() == nodegit.Object.TYPE.COMMIT) {
            return gitObject.id();
        } else {
            throw Error(rev + " is not a valid commit.");
        }
    });
};



module.exports = RelateCommits;
