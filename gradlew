#!/usr/bin/env sh

# Gradle startup script for Unix/Mac/Linux

# Locate Java
if [ -n "$JAVA_HOME" ] ; then
    JAVA_EXE="$JAVA_HOME/bin/java"
else
    JAVA_EXE="java"
fi

# Run Gradle Wrapper
exec "$JAVA_EXE" -Xmx64m -Xms64m -cp "gradle/wrapper/gradle-wrapper.jar" org.gradle.wrapper.GradleWrapperMain "$@"
