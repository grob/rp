About rp
========

rp is a package manager for [RingoJS]. It aims to provide an easy way to both manage packages of local RingoJS installations and to publish packages in a remote package registry (by default the [RingoJS Package Registry]).


Status
======

**rp is experimental beta**, so expect bugs. Because of that and because rp adds and removes files, directories and links on local disks you should not use it on production systems or without an up-to-date backup.

**Important note for Windows users:** As of now, rp is largely untested on Windows (due to the fact that none of my computers run Windows), so your mileage may vary.


Installation
============

rp can be easily installed using `ringo-admin`:

    ringo-admin install http://packages.ringojs.org/download/rp/latest

**Note** that rp will be installed within the RingoJS installation containing `ringo-admin` script. If you have the environment variable `RINGO_HOME` set, rp will be installed where it points to (so if want to try out rp in a pristine RingoJS installation, make sure to unset `RINGO_HOME` before).


Usage
=====

If you have RingoJS' `bin` directory in the path (which you should), you can start rp by simply entering

	rp

on the command line. If called without a command rp will output the list of available commands. To get detailed information about a command simply call

	rp help <command>

Replace <command> with the command you want information about.


Configuration
=============

rp stores it's configuration and a local cache of the package registry catalog in a subdirectory of the user's home directory. On Linux/OS X the directory is `$HOME/.rp/`, on Windows `USER_HOME/rp/`.

Normally rp doesn't need any configuration. If you want to use a package registry different than the [RingoJS Package Registry] or explicitly specify a RingoJS installation to manage packages for (normally rp uses the one it has been installed in), use

	rp config

The configuration will be stored in a file "config" within the rp directory.


Uninstallation
==============

rp itself is a RingoJS package, so it's as easy to uninstall as other packages: remove the directory packages/rp and the symlinks in RingoJS' bin directory.


Bugs/Enhancements
=================

If you encounter bugs or unexpected behaviour, or have any ideas on how to make rp better, please file an [issue] on GitHub.


Disclaimer
==========

rp is provided as-is, without warranty of any kind, expressed or implied.

The packages in the [RingoJS Package Registry] registry are the sole property of their respective maintainers, and are in no way affiliated with or endorsed by [RingoJS Package Registry] or the maintainers of the registry. There is absolutely no guarantee, warrantee, or assertion made as to the quality, fitness for a specific purpose or lack of malice in any given package published in the [RingoJS Package Registry] registry.

 [RingoJS]: http://ringojs.org/
 [RingoJS Package Registry]: http://packages.ringojs.org/
 [issue]: https://github.com/grob/rp/issues
