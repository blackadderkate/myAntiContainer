#!/bin/sh
#fpc -MObjFPC -Scghi -CX -Cg -O3 -XX -l -vewnhiq -Filib/x86_64-linux -Fu. -FUlib/x86_64-linux -FE. -obinaries/linux_amd64/AntiContainerHelper Project1.pas
fpc -MObjFPC -Scghi -CX -Cg -O3 -XX -l -vewnhiq -Filib/x86_64-linux -Fu. -FUlib/x86_64-linux -FE. -o./AntiContainerHelper Project1.pas
