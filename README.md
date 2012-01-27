About rp
========

rp is a package manager for [RingoJS]. It aims to provide an easy way to both manage packages of local RingoJS installations and to publish packages in a remote package registry (by default [rpr]).


Status
======

**rp is experimental beta**, so expect bugs. Because of that and because rp adds and removes files, directories and links on local disks you should not use it on production systems or without an up-to-date backup.


Installation
============

rp should be installed using the following command line:

    echo `curl -s http://rpr.nomatic.org/install.js` | path/to/bin/ringo

Change `path/to/bin/ringo` to the path of the ringo start script. **Note** that rp will be installed within the RingoJS installation containing the start script.


Usage
=====

If you have RingoJS' `bin` directory in the path (which you should), you can start rp by simply entering

	rp

on the command line. If called without a command rp will output the list of available commands. To get defailed information about a command simply call

	rp help <command>

Replace <command> with the command you want information about.


Configuration
=============

rp stores it's configuration and a local cache of the package registry catalog in a subdirectory of the user's home directory. On Linux/OS X the directory is `$HOME/.rp/`, on Windows `USER_HOME/rp/`.

Normally rp doesn't need any configuration. If you want to use a package registry different than [rpr] or explicitly specify a RingoJS installation to manage packages for (normally rp uses the one it has been installed in), use

	rp config

The configuration will be stored in a file "config" within the rp directory.


Uninstallation
==============

rp itself is a RingoJS package, so it's as easy to uninstall as other packages: remove
the directory packages/rp and the symlinks in RingoJS' bin directory.


Bugs/Enhancements
=================

If you encounter bugs or unexpected behaviour, or have any ideas on how to make rp better, please file an [issue] on GitHub.


Disclaimer
==========

rp is provided as-is, without warranty of any kind, expressed or implied.

The packages in the [rpr] registry are the sole property of their respective maintainers, and are in no way affiliated with or endorsed by [rpr] or the maintainers of the registry. There is absolutely no guarantee, warrantee, or assertion made as to the quality, fitness for a specific purpose or lack of malice in any given package published in the [rpr] registry.

 [RingoJS]: http://ringojs.org/
 [rpr]: http://rpr.nomatic.org/
 [issue]: https://github.com/grob/rp/issues
