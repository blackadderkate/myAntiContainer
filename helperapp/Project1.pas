program Project1;
{$I-}
uses
  SysUtils, DateUtils, fpjson, jsonparser, crt, strutils;

var
  FileHandle:File of Char;
  MessageSize:longint;
  Message:String;
  Buffer1:array[0..3] of byte;
  Buffer:array[0..4096] of byte;
  Filename,decodedFilename,newFilename:String;
  jObject :TJSONObject;
  LastModTime:Int64;
  f:integer;
  x:char;
  LocalTime:TDateTime;
const debug: boolean = false;


function reformatFilename(filename:string):string;
var
  leftbracket,rightbracket,bracketvalue,f:integer;
  s,newfilename,fileext:string;
begin
  newfilename:=filename;
  s:='';
  f:=0;
  leftbracket:=Rpos('(',filename);
  rightbracket:=Rpos(').',filename);
  fileext:=extractfileext(filename);
  if (leftbracket>0) and (rightbracket>0) then
  begin
    s:=copy(filename,leftbracket+1,(rightbracket-leftbracket-1));
    filename:=copy(filename,0,leftbracket-1)+fileext;
    try
      bracketvalue:=strtoint(s);
    except
      bracketvalue:=-1;
    end;
    if bracketvalue>-1 then
    begin
      if (copy(filename,leftbracket-1,1)=' ') then dec(leftbracket);
      filename:=copy(filename,1,leftbracket-1);
      newfilename:=filename+fileext;
      while fileexists(newfilename) do
      begin
        inc(f);
        newfilename:=filename+'_'+format('%.3d',[f])+fileext;
      end;
    end;
  end;
  result:=newfilename;
end;
function URLDecode(s: string): string;
var
  i,lengthsource: integer;
  source: PAnsiChar;
begin
  result := '';
  source := pansichar(s);
  if (debug) then writeln(STDERR,source);
  lengthsource := length(source);
  i:=1;
  while (i<=lengthsource) do
    begin
      if source[i-1] <> '%' then
        result := result + source[i-1]
      else if (source[i-1] = '%') and (i+1<=lengthsource) then
        try
          begin
            if (debug) then writeln(STDERR,#13+'DEBUG '+chr(Hex2Dec('$'+source[i]+source[i+1])));
            result := result + Chr(Hex2Dec('$'+source[i]+source[i+1]));
            i:=i+2;
          end;
        except
        end
      else
        result := result + source[i-1];
      inc(i);
    end;
end;

begin
  if debug then writeln(STDERR,'***************');
  if debug then writeln(STDERR,'* MAIN THREAD *');
  if debug then writeln(STDERR,'***************');


  FillChar(buffer,4095,#0);
  FillChar(buffer1,4,#0);
  Message:='';
  decodedFilename:='';
  if debug then
  begin
    filename:='TBA';
    LastModTime:=1616752800;
  end
  else
  begin
    FileMode := 0;
    Assign(FileHandle,'');
    Reset(FileHandle,1);
    BlockRead(FileHandle,Buffer1,4);
    if (IOResult<>0) then exit;
    MessageSize:=(PInteger(@Buffer1)^);
    if (debug) then writeln(STDERR,'MessageSize='+inttostr(MessageSize));
    FillChar(buffer,4095,#0);
    Message:='';
    x:=chr(0);
    for f:=1 to MessageSize do
    begin
    BlockRead(FileHandle, x, 1);
    Message:=Message+x;
    end;
    Close(FileHandle);
    jObject := TJSONObject(GetJSON(Message));
    filename:=(jObject.Get('filename'));
    LastModTime:=jObject.Get('LastModTime');
  end;
  if (length(filename)>0) then
  begin
    if (debug) then writeln(STDERR,'0:'+filename);
    filename:=StringReplace(filename,'%2F','/',[rfReplaceAll,rfIgnoreCase]);
    if (debug) then writeln(STDERR,'1:'+filename);
    decodedFilename:=urlDecode(filename);
    if (debug) then writeln(STDERR,'2:'+decodedFilename);
    if (fileexists(decodedFilename)) then
    begin
      newFilename:=reformatFilename(decodedFilename);
      message:='';
      if (newFilename <> decodedFilename) then
      begin
        if not(debug) then
          RenameFile(decodedFilename,newfilename);
        message:='Renamed \"'+decodedFilename+'\" to \"'+newfilename+'\".\n';
        decodedFilename:=newfilename;
      end;
      if (LastModTime>0) then
      begin
        LocalTime:=(UniversalTimeToLocal(UnixToDateTime(LastModTime div 1000)));
        FileSetDate(decodedFilename,DateTimeToFileDate(LocalTime));
        message:='"\n'+message+('Changed \"'+decodedFilename+'\" modified date to '+DateTimeToStr(LocalTime)+'."');
        if (debug) then writeln(STDERR,message);
      end;
    end
    else
      message:='"File '+filename+' not found???"';
  end;
  if (length(filename)=0) and (LastModTime=0) then
  begin
    if (debug) then writeln(STDERR,'DEBUG6');
    message:='"OK"';
  end;
  if (debug) then writeln(STDERR,message);
  messagesize:=(length(message));
  move(messagesize,buffer1,4);
  move(pchar(message)^,buffer,messagesize);
  if debug then
    Assign(FileHandle,'/tmp/AntiContainerHelperDebugLog.txt')
  else
    Assign(FileHandle,'');
  Rewrite(FileHandle);
  BlockWrite(FileHandle,buffer1,4);
  BlockWrite(FileHandle,buffer,messagesize);
  Close(FileHandle);
end.

